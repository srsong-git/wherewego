-- Couple production-catalog result persistence.
--
-- The catalog remains server-only. This migration grants the Edge Function's
-- service role the minimum read access required by the security-invoker view,
-- and keeps browser roles explicitly revoked.

grant select on public.couple_venues, public.couple_recommendation_items to service_role;
grant select on public.couple_recommendation_catalog to service_role;

revoke all on public.couple_venues, public.couple_recommendation_items
  from public, anon, authenticated;
revoke all on public.couple_recommendation_catalog
  from public, anon, authenticated;

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
  target_dataset_version text := target_result ->> 'datasetVersion';
  target_algorithm_version text := target_result ->> 'algorithmVersion';
  target_items jsonb := coalesce(target_result -> 'items', '[]'::jsonb);
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
  if coalesce(target_status, '') not in ('ready', 'no_match') then raise exception 'INVALID_RESULT'; end if;
  if coalesce(target_dataset_version, '') not in ('couple-fixture-v1', 'couple-production-phase1b2b-v1') then
    raise exception 'INVALID_DATASET_VERSION';
  end if;
  if target_algorithm_version is distinct from 'consensus-v1.1' then
    raise exception 'INVALID_ALGORITHM_VERSION';
  end if;
  if jsonb_typeof(target_items) <> 'array' then raise exception 'INVALID_RESULT_ITEMS'; end if;
  if target_status = 'ready' and jsonb_array_length(target_items) not between 1 and 3 then
    raise exception 'INVALID_RESULT_ITEMS';
  end if;
  if target_status = 'no_match' and jsonb_array_length(target_items) <> 0 then
    raise exception 'INVALID_RESULT_ITEMS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_items) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
      or jsonb_typeof(item.value -> 'place') is distinct from 'object'
  ) then
    raise exception 'INVALID_RESULT_ITEMS';
  end if;

  if target_status = 'ready' and exists (
    select 1
    from jsonb_array_elements(target_items) as item(value)
    where coalesce(item.value ->> 'rank', '') !~ '^[1-3]$'
  ) then
    raise exception 'INVALID_RESULT_RANKS';
  end if;

  if target_status = 'ready' and (
    select count(*) <> count(distinct ranked_item.rank)
      or min(ranked_item.rank) <> 1
      or max(ranked_item.rank) <> count(*)
    from (
      select (item.value ->> 'rank')::smallint as rank
      from jsonb_array_elements(target_items) as item(value)
    ) as ranked_item
  ) then
    raise exception 'INVALID_RESULT_RANKS';
  end if;

  -- place_snapshot is the only result payload returned to the browser. Keep it
  -- to an explicit public allowlist and reject all Editorial/Human metadata or
  -- internal UUIDs even if a future Edge Function accidentally includes them.
  if exists (
    select 1
    from jsonb_array_elements(target_items) as item(value)
    cross join lateral jsonb_object_keys(coalesce(item.value -> 'place', '{}'::jsonb)) as place_key(key)
    where place_key.key <> all (array[
      'id', 'name', 'description', 'area', 'meetingArea', 'category',
      'activityType', 'energy', 'novelty', 'budgetPerPerson', 'durationMinutes',
      'indoorOutdoor', 'walkingLevel', 'waitRisk', 'address', 'latitude',
      'longitude', 'kakaoPlaceId', 'kakaoPlaceName', 'kakaoPlaceUrl'
    ]::text[])
  ) then
    raise exception 'INVALID_PUBLIC_PLACE_SNAPSHOT';
  end if;

  if target_dataset_version = 'couple-fixture-v1' then
    if exists (
      select 1
      from jsonb_array_elements(target_items) as item(value)
      where item.value ->> 'recommendationItemId' is not null
        or coalesce(item.value ->> 'placeId', '') !~ '^fixture-'
    ) then
      raise exception 'INVALID_FIXTURE_RESULT_ITEM';
    end if;
  else
    -- Production result items must still be eligible at persistence time. Rank
    -- 1 additionally has to pass the keep_primary projection from the Human
    -- Curation Gate; alternative_only can only occupy ranks 2 or 3.
    if exists (
      select 1
      from jsonb_array_elements(target_items) as item(value)
      where coalesce(item.value ->> 'placeId', '') = ''
        or (item.value ->> 'placeId') is distinct from (item.value #>> '{place,id}')
        or (item.value ->> 'placeId')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
      raise exception 'INVALID_PUBLIC_PLACE_ID';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(target_items) as item(value)
      left join public.couple_recommendation_catalog as catalog
        on catalog.id = case
          when coalesce(item.value ->> 'recommendationItemId', '')
            ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (item.value ->> 'recommendationItemId')::uuid
          else null
        end
       and catalog.source_key = item.value ->> 'placeId'
       and catalog.source_key = item.value #>> '{place,id}'
       and catalog.meeting_area = target_session.meeting_area
       and catalog.dataset_version = target_dataset_version
       and catalog.recommendation_eligible
       and catalog.alternative_recommendation_eligible
      where catalog.id is null
        or ((item.value ->> 'rank')::smallint = 1 and not catalog.primary_recommendation_eligible)
    ) then
      raise exception 'INVALID_PRODUCTION_RESULT_ITEM';
    end if;
  end if;

  insert into public.recommendation_results (
    session_id, agreement_score, shared_points, difference_points, compromise_text,
    dataset_version, algorithm_version
  ) values (
    target_session.id,
    (target_result ->> 'agreementScore')::smallint,
    array(select jsonb_array_elements_text(coalesce(target_result -> 'sharedPoints', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(target_result -> 'differencePoints', '[]'::jsonb))),
    target_result ->> 'compromiseText',
    target_dataset_version,
    target_algorithm_version
  ) returning id into inserted_result_id;

  if target_status = 'ready' then
    insert into public.recommendation_result_items (
      result_id, rank, item_role, place_id, recommendation_item_id, score, reason, place_snapshot
    )
    select
      inserted_result_id,
      (item.value ->> 'rank')::smallint,
      'activity',
      item.value ->> 'placeId',
      case
        when target_dataset_version = 'couple-fixture-v1' then null
        else (item.value ->> 'recommendationItemId')::uuid
      end,
      (item.value ->> 'score')::numeric,
      item.value ->> 'reason',
      item.value -> 'place'
    from jsonb_array_elements(target_items) as item(value);
  end if;

  update public.decision_sessions
  set status = target_status,
      dataset_version = target_dataset_version,
      algorithm_version = target_algorithm_version,
      completed_at = now(),
      expires_at = now() + interval '72 hours'
  where id = target_session.id;

  return true;
end;
$$;

revoke all on function public.complete_decision_session(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_decision_session(uuid, jsonb)
  to service_role;

comment on function public.complete_decision_session(uuid, jsonb) is
  'Persists versioned fixture or server-only production Couple results with an allowlisted public place snapshot.';
