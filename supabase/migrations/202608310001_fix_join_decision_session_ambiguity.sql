-- Phase 1A live E2E fix: qualify the participant session column so it does
-- not conflict with the TABLE-returning function's session_id output name.

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
  if (
    select count(*)
    from public.session_participants as participant
    where participant.session_id = target_session.id
  ) >= 2 then
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

notify pgrst, 'reload schema';
