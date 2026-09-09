-- Couple Phase 0/1A: anonymous-safe reviews and private two-person decision sessions.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create or replace function private.current_user_is_permanent()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

grant usage on schema private to authenticated;
revoke all on function private.current_user_is_permanent() from public, anon;
grant execute on function private.current_user_is_permanent() to authenticated;

-- Anonymous Supabase users also use the authenticated Postgres role. Keep the
-- existing family reviews limited to permanent Kakao users.
drop policy if exists "Signed-in users can create their own reviews" on public.reviews;
create policy "Permanent users can create their own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_permanent())
  );

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Permanent users can update their own reviews"
  on public.reviews
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_permanent())
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_permanent())
  );

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Permanent users can delete their own reviews"
  on public.reviews
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_permanent())
  );

drop policy if exists "Users can create their own reports" on public.review_reports;
create policy "Permanent users can create their own reports"
  on public.review_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and (select private.current_user_is_permanent())
    and public.can_report_review(review_id)
  );

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '영구 로그인이 필요합니다.';
  end if;

  delete from public.reviews where user_id = requesting_user_id;

  insert into public.account_deletion_requests (user_id, status, requested_at)
  values (requesting_user_id, 'pending', now())
  on conflict (user_id) do update
    set status = 'pending', requested_at = excluded.requested_at;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

create table public.decision_sessions (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique check (public_code ~ '^[a-f0-9]{16}$'),
  decision_type text not null default 'activity' check (decision_type in ('activity', 'restaurant', 'course')),
  meeting_area text not null check (meeting_area in ('seongsu', 'hongdae', 'jongno_euljiro')),
  status text not null default 'collecting' check (status in ('collecting', 'processing', 'ready', 'no_match', 'expired')),
  participant_limit smallint not null default 2 check (participant_limit = 2),
  submitted_count smallint not null default 0 check (submitted_count between 0 and 2),
  questionnaire_version text not null default 'activity-v1',
  dataset_version text not null default 'couple-fixture-v1',
  algorithm_version text not null default 'consensus-v1',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '72 hours')
);

create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.decision_sessions(id) on delete cascade,
  target_slot text not null default 'B' check (target_slot = 'B'),
  secret_hash bytea not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (session_id, target_slot)
);

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.decision_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('A', 'B')),
  joined_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (session_id, user_id),
  unique (session_id, slot)
);

create table public.preference_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.decision_sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  questionnaire_version text not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create table public.recommendation_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.decision_sessions(id) on delete cascade,
  result_mode text not null default 'single' check (result_mode in ('single', 'course')),
  agreement_score smallint not null check (agreement_score between 0 and 100 and agreement_score % 5 = 0),
  shared_points text[] not null default '{}',
  difference_points text[] not null default '{}',
  compromise_text text not null,
  dataset_version text not null,
  algorithm_version text not null,
  created_at timestamptz not null default now()
);

create table public.recommendation_result_items (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.recommendation_results(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  item_role text not null default 'activity' check (item_role in ('activity', 'restaurant')),
  place_id text not null,
  score numeric(6, 2) not null check (score between 0 and 100),
  reason text not null,
  place_snapshot jsonb not null,
  unique (result_id, rank)
);

create index decision_sessions_status_expires_idx on public.decision_sessions (status, expires_at);
create index session_participants_user_session_idx on public.session_participants (user_id, session_id);
create index preference_responses_session_idx on public.preference_responses (session_id);

alter table public.decision_sessions enable row level security;
alter table public.session_invites enable row level security;
alter table public.session_participants enable row level security;
alter table public.preference_responses enable row level security;
alter table public.recommendation_results enable row level security;
alter table public.recommendation_result_items enable row level security;

revoke all on public.decision_sessions, public.session_invites, public.session_participants,
  public.preference_responses, public.recommendation_results, public.recommendation_result_items
  from anon, authenticated;
grant select on public.decision_sessions to authenticated;

create or replace function private.is_session_participant(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = target_session_id
      and participant.user_id = auth.uid()
  );
$$;

revoke all on function private.is_session_participant(uuid) from public, anon;
grant execute on function private.is_session_participant(uuid) to authenticated;

create policy "Participants can read their decision session"
  on public.decision_sessions
  for select
  to authenticated
  using ((select private.is_session_participant(id)));

create or replace function private.valid_activity_answers(candidate jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(candidate) = 'object'
    and candidate ->> 'activity' in ('cafe', 'exhibition_popup', 'experience', 'walk_culture', 'any')
    and candidate ->> 'energy' in ('low', 'medium', 'high')
    and candidate ->> 'novelty' in ('proven', 'balanced', 'new')
    and candidate ->> 'budget' in ('under_20000', 'under_40000', 'any')
    and candidate ->> 'duration' in ('120', '240', 'unlimited')
    and jsonb_typeof(candidate -> 'vetoes') = 'array'
    and jsonb_array_length(candidate -> 'vetoes') <= 2
    and not exists (
      select 1
      from jsonb_array_elements_text(candidate -> 'vetoes') as veto(value)
      where veto.value not in ('outdoor', 'long_walk', 'long_wait', 'cafe', 'high_cost', 'car_required')
    );
$$;

create or replace function public.create_decision_session(target_meeting_area text)
returns table (session_id uuid, public_code text, invite_secret text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  generated_session_id uuid;
  generated_public_code text;
  generated_invite_secret text;
begin
  if requesting_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if target_meeting_area not in ('seongsu', 'hongdae', 'jongno_euljiro') then
    raise exception 'INVALID_MEETING_AREA';
  end if;

  loop
    generated_public_code := encode(extensions.gen_random_bytes(8), 'hex');
    begin
      insert into public.decision_sessions (public_code, meeting_area)
      values (generated_public_code, target_meeting_area)
      returning id into generated_session_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  generated_invite_secret := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.session_invites (session_id, secret_hash)
  values (generated_session_id, extensions.digest(generated_invite_secret, 'sha256'));

  insert into public.session_participants (session_id, user_id, slot)
  values (generated_session_id, requesting_user_id, 'A');

  return query select generated_session_id, generated_public_code, generated_invite_secret;
end;
$$;

revoke all on function public.create_decision_session(text) from public, anon;
grant execute on function public.create_decision_session(text) to authenticated;

create or replace function public.join_decision_session(target_public_code text, target_invite_secret text)
returns table (session_id uuid, participant_slot text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_session public.decision_sessions%rowtype;
  target_invite public.session_invites%rowtype;
  existing_participant public.session_participants%rowtype;
begin
  if requesting_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select session.* into target_session
  from public.decision_sessions as session
  where session.public_code = lower(target_public_code)
  for update;

  if target_session.id is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select participant.* into existing_participant
  from public.session_participants as participant
  where participant.session_id = target_session.id
    and participant.user_id = requesting_user_id;

  if existing_participant.id is not null then
    return query select target_session.id, existing_participant.slot;
    return;
  end if;

  if target_session.expires_at <= now() or target_session.status = 'expired' then
    update public.decision_sessions set status = 'expired' where id = target_session.id;
    raise exception 'ROOM_EXPIRED';
  end if;
  if target_session.status <> 'collecting' then
    raise exception 'ROOM_FULL';
  end if;
  if (select count(*) from public.session_participants where session_id = target_session.id) >= 2 then
    raise exception 'ROOM_FULL';
  end if;

  select invite.* into target_invite
  from public.session_invites as invite
  where invite.session_id = target_session.id and invite.target_slot = 'B'
  for update;

  if target_invite.id is null
    or target_invite.used_at is not null
    or target_invite.secret_hash <> extensions.digest(target_invite_secret, 'sha256') then
    raise exception 'INVALID_INVITE';
  end if;

  insert into public.session_participants (session_id, user_id, slot)
  values (target_session.id, requesting_user_id, 'B')
  returning * into existing_participant;

  update public.session_invites set used_at = now() where id = target_invite.id;
  return query select target_session.id, existing_participant.slot;
end;
$$;

revoke all on function public.join_decision_session(text, text) from public, anon;
grant execute on function public.join_decision_session(text, text) to authenticated;

create or replace function public.resume_decision_session(target_public_code text)
returns table (session_id uuid, participant_slot text)
language sql
stable
security definer
set search_path = ''
as $$
  select session.id, participant.slot
  from public.decision_sessions as session
  join public.session_participants as participant on participant.session_id = session.id
  where session.public_code = lower(target_public_code)
    and participant.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.resume_decision_session(text) from public, anon;
grant execute on function public.resume_decision_session(text) to authenticated;

create or replace function public.submit_preference_response(
  target_session_id uuid,
  target_questionnaire_version text,
  target_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_session public.decision_sessions%rowtype;
  target_participant public.session_participants%rowtype;
  next_submitted_count smallint;
begin
  if requesting_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select session.* into target_session
  from public.decision_sessions as session
  where session.id = target_session_id
  for update;
  if target_session.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if target_session.expires_at <= now() or target_session.status = 'expired' then
    update public.decision_sessions set status = 'expired' where id = target_session.id;
    raise exception 'ROOM_EXPIRED';
  end if;

  select participant.* into target_participant
  from public.session_participants as participant
  where participant.session_id = target_session.id
    and participant.user_id = requesting_user_id
  for update;
  if target_participant.id is null then raise exception 'NOT_A_PARTICIPANT'; end if;
  if target_participant.submitted_at is not null then return; end if;
  if target_session.status <> 'collecting' then raise exception 'ROOM_NOT_COLLECTING'; end if;
  if target_questionnaire_version <> target_session.questionnaire_version
    or not private.valid_activity_answers(target_answers) then
    raise exception 'INVALID_ANSWERS';
  end if;

  insert into public.preference_responses (
    session_id, participant_id, questionnaire_version, answers
  ) values (
    target_session.id, target_participant.id, target_questionnaire_version, target_answers
  ) on conflict (session_id, participant_id) do nothing;

  update public.session_participants
  set submitted_at = now()
  where id = target_participant.id and submitted_at is null;

  select count(*)::smallint into next_submitted_count
  from public.session_participants
  where session_id = target_session.id and submitted_at is not null;

  update public.decision_sessions
  set submitted_count = next_submitted_count,
      status = case when next_submitted_count = 2 then 'processing' else 'collecting' end
  where id = target_session.id;
end;
$$;

revoke all on function public.submit_preference_response(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_preference_response(uuid, text, jsonb) to authenticated;

create or replace function public.get_decision_session_state(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_session public.decision_sessions%rowtype;
  target_participant public.session_participants%rowtype;
  result_payload jsonb;
begin
  if requesting_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select session.* into target_session
  from public.decision_sessions as session
  where session.id = target_session_id;
  if target_session.id is null then raise exception 'ROOM_NOT_FOUND'; end if;

  select participant.* into target_participant
  from public.session_participants as participant
  where participant.session_id = target_session.id
    and participant.user_id = requesting_user_id;
  if target_participant.id is null then raise exception 'NOT_A_PARTICIPANT'; end if;

  if target_session.expires_at <= now() and target_session.status <> 'expired' then
    update public.decision_sessions set status = 'expired' where id = target_session.id;
    target_session.status := 'expired';
  end if;

  select jsonb_build_object(
    'agreementScore', result.agreement_score,
    'sharedPoints', to_jsonb(result.shared_points),
    'differencePoints', to_jsonb(result.difference_points),
    'compromiseText', result.compromise_text,
    'datasetVersion', result.dataset_version,
    'algorithmVersion', result.algorithm_version,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', item.rank,
        'role', item.item_role,
        'placeId', item.place_id,
        'score', item.score,
        'reason', item.reason,
        'place', item.place_snapshot
      ) order by item.rank)
      from public.recommendation_result_items as item
      where item.result_id = result.id
    ), '[]'::jsonb)
  ) into result_payload
  from public.recommendation_results as result
  where result.session_id = target_session.id;

  return jsonb_build_object(
    'sessionId', target_session.id,
    'publicCode', target_session.public_code,
    'meetingArea', target_session.meeting_area,
    'status', target_session.status,
    'participantSlot', target_participant.slot,
    'participantCount', (select count(*) from public.session_participants where session_id = target_session.id),
    'submittedCount', target_session.submitted_count,
    'mySubmitted', target_participant.submitted_at is not null,
    'questionnaireVersion', target_session.questionnaire_version,
    'datasetVersion', target_session.dataset_version,
    'algorithmVersion', target_session.algorithm_version,
    'expiresAt', target_session.expires_at,
    'completedAt', target_session.completed_at,
    'result', result_payload
  );
end;
$$;

revoke all on function public.get_decision_session_state(uuid) from public, anon;
grant execute on function public.get_decision_session_state(uuid) to authenticated;

create or replace function public.complete_decision_session(
  target_session_id uuid,
  target_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.decision_sessions%rowtype;
  inserted_result_id uuid;
  target_status text := target_result ->> 'status';
begin
  select session.* into target_session
  from public.decision_sessions as session
  where session.id = target_session_id
  for update;
  if target_session.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if target_session.status in ('ready', 'no_match') then return false; end if;
  if target_session.status <> 'processing' or target_session.submitted_count <> 2 then
    raise exception 'ROOM_NOT_READY_FOR_FINALIZATION';
  end if;
  if target_status not in ('ready', 'no_match') then raise exception 'INVALID_RESULT'; end if;

  insert into public.recommendation_results (
    session_id, agreement_score, shared_points, difference_points, compromise_text,
    dataset_version, algorithm_version
  ) values (
    target_session.id,
    (target_result ->> 'agreementScore')::smallint,
    array(select jsonb_array_elements_text(coalesce(target_result -> 'sharedPoints', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(target_result -> 'differencePoints', '[]'::jsonb))),
    target_result ->> 'compromiseText',
    target_session.dataset_version,
    target_session.algorithm_version
  ) returning id into inserted_result_id;

  if target_status = 'ready' then
    insert into public.recommendation_result_items (
      result_id, rank, item_role, place_id, score, reason, place_snapshot
    )
    select
      inserted_result_id,
      (item.value ->> 'rank')::smallint,
      'activity',
      item.value ->> 'placeId',
      (item.value ->> 'score')::numeric,
      item.value ->> 'reason',
      item.value -> 'place'
    from jsonb_array_elements(coalesce(target_result -> 'items', '[]'::jsonb)) as item(value);
  end if;

  update public.decision_sessions
  set status = target_status,
      completed_at = now(),
      expires_at = now() + interval '72 hours'
  where id = target_session.id;
  return true;
end;
$$;

revoke all on function public.complete_decision_session(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_decision_session(uuid, jsonb) to service_role;

create or replace function public.cleanup_expired_decision_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.decision_sessions where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_decision_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_expired_decision_sessions() to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'decision_sessions'
  ) then
    alter publication supabase_realtime add table public.decision_sessions;
  end if;
end
$$;

notify pgrst, 'reload schema';
