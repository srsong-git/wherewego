-- Couple Phase 1B-2A: add a Human Curation Gate after Editorial eligibility.
--
-- Human curation is categorical eligibility metadata. It is never added to
-- Editorial, Preference, or weighted Consensus scores. The migration updates
-- only the independently curated Couple dataset and does not touch Family data.

alter table public.couple_recommendation_items
  add column if not exists human_curation_status text not null default 'research_hold',
  add column if not exists human_curation_reviewed_at timestamptz,
  add column if not exists human_curation_gate_version text;

do $migration$
declare
  target_count integer;
  keep_count integer;
  alternative_count integer;
  hold_count integer;
begin
  select count(*) into target_count
  from public.couple_recommendation_items
  where dataset_version = 'couple-production-phase1b2a-v1';

  if target_count <> 71 then
    raise exception 'Expected 71 Phase 1B-2A Items, found %', target_count;
  end if;

  update public.couple_recommendation_items
  set
    human_curation_status = 'alternative_only',
    human_curation_reviewed_at = '2026-09-01T15:00:00+09:00'::timestamptz,
    human_curation_gate_version = 'couple-human-curation-v1',
    updated_at = now()
  where dataset_version = 'couple-production-phase1b2a-v1';

  update public.couple_recommendation_items
  set human_curation_status = 'keep_primary', updated_at = now()
  where source_key = any(array[
    'item-groot-climbing',
    'item-realworld-seongsu',
    'item-dotnote-seongsu',
    'event-dmuseum-taste-house-2',
    'item-haus-nowhere-seoul',
    'event-ktng-enlistment-eve',
    'item-redbutton-layered-hongdae',
    'item-ring-university-hongdae',
    'item-beat-phobia-hongdae-dungeon3',
    'item-seongsu-museum-yeonnam-drawing',
    'item-zero-world-hongdae',
    'item-cafe-layered-yeonnam',
    'item-code-k-hongdae',
    'item-dotnote-hongdae',
    'event-ilmin-vibe-era',
    'event-ilmin-off-the-white',
    'item-mmca-seoul-visit',
    'item-arario-museum-in-space-visit',
    'item-dialogue-in-dark',
    'item-peakers-jongno'
  ]::text[]);

  update public.couple_recommendation_items
  set human_curation_status = 'research_hold', updated_at = now()
  where source_key = any(array[
    'event-amore-story-a-beauty-murder',
    'item-w-rock-bowling-hongdae',
    'item-seoul-record'
  ]::text[]);

  select count(*) into keep_count
  from public.couple_recommendation_items
  where dataset_version = 'couple-production-phase1b2a-v1'
    and human_curation_status = 'keep_primary';
  select count(*) into alternative_count
  from public.couple_recommendation_items
  where dataset_version = 'couple-production-phase1b2a-v1'
    and human_curation_status = 'alternative_only';
  select count(*) into hold_count
  from public.couple_recommendation_items
  where dataset_version = 'couple-production-phase1b2a-v1'
    and human_curation_status = 'research_hold';

  if keep_count <> 20 then
    raise exception 'Human Curation keep_primary seed must contain 20 Items';
  end if;
  if alternative_count <> 48 then
    raise exception 'Human Curation alternative_only seed must contain 48 Items';
  end if;
  if hold_count <> 3 then
    raise exception 'Human Curation research_hold seed must contain 3 Items';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_human_curation_status_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_human_curation_status_check
      check (human_curation_status in ('keep_primary', 'alternative_only', 'research_hold'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_human_curation_lifecycle_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_human_curation_lifecycle_check
      check (
        status <> 'active'
        or (
          human_curation_reviewed_at is not null
          and length(btrim(human_curation_gate_version)) > 0
        )
      ) not valid;
  end if;
end
$migration$;

alter table public.couple_recommendation_items
  validate constraint couple_recommendation_items_human_curation_lifecycle_check;

create index if not exists couple_recommendation_items_human_candidate_idx
  on public.couple_recommendation_items (dataset_version, human_curation_status)
  where status = 'active';

create or replace view public.couple_recommendation_catalog
with (security_invoker = true)
as
with catalog as (
  select
    item.*,
    venue.source_key as venue_source_key,
    venue.canonical_name as venue_name,
    venue.address,
    venue.latitude,
    venue.longitude,
    venue.kakao_place_id,
    venue.kakao_detail_url,
    venue.meeting_area,
    (
      venue.status = 'active'
      and item.status = 'active'
      and (item.valid_from is null or item.valid_from <= now())
      and (item.valid_until is null or item.valid_until > now())
      and (
        item.freshness_class <> 'temporary'
        or (item.freshness_expires_at is not null and item.freshness_expires_at > now())
      )
      and item.availability_verified_at is not null
      and item.availability_review_due_at > now()
      and item.availability_status in ('available', 'limited', 'walk_in_only')
      and (
        not item.booking_required
        or (
          item.booking_url is not null
          and item.availability_status in ('available', 'limited')
          and (item.booking_open_at is null or item.booking_open_at <= now())
          and (item.booking_close_at is null or item.booking_close_at > now())
        )
      )
    ) as operational_eligible_internal,
    (
      item.curation_origin = 'independent_couple_research'
      and item.editorial_tier in ('hero', 'standard', 'coverage')
      and item.editorial_score is not null
      and item.editorial_reviewed_at is not null
      and item.editorial_review_due_at > now()
      and jsonb_typeof(item.editorial_evidence_refs) = 'array'
      and jsonb_array_length(item.editorial_evidence_refs) > 0
      and item.editorial_gate_version is not null
      and length(btrim(item.editorial_rationale)) >= 20
    ) as editorial_eligible_internal,
    (
      item.human_curation_status in ('keep_primary', 'alternative_only')
      and item.human_curation_reviewed_at is not null
      and item.human_curation_gate_version = 'couple-human-curation-v1'
    ) as human_curation_eligible_internal
  from public.couple_recommendation_items as item
  join public.couple_venues as venue on venue.id = item.venue_id
)
select
  id,
  source_key,
  venue_id,
  item_kind,
  canonical_name,
  summary,
  category,
  activity_traits,
  energy_level,
  novelty_level,
  freshness_class,
  freshness_reason,
  freshness_verified_at,
  freshness_review_due_at,
  freshness_expires_at,
  price_band,
  typical_spend_per_person,
  required_spend_per_person,
  price_basis,
  price_note,
  recommended_duration_minutes,
  indoor_outdoor,
  walking_level,
  wait_risk,
  car_required,
  mobility_score,
  status,
  valid_from,
  valid_until,
  verified_at,
  source_references,
  dataset_kind,
  dataset_version,
  created_at,
  updated_at,
  venue_source_key,
  venue_name,
  address,
  latitude,
  longitude,
  kakao_place_id,
  kakao_detail_url,
  meeting_area,
  case
    when freshness_review_due_at <= now()
      or (freshness_expires_at is not null and freshness_expires_at <= now())
      then 'stale'
    else freshness_class
  end as freshness_state,
  case
    when novelty_level = 'new'
      and (
        freshness_review_due_at <= now()
        or (freshness_expires_at is not null and freshness_expires_at <= now())
      )
      then 'balanced'
    else novelty_level
  end as effective_novelty_level,
  (operational_eligible_internal and editorial_eligible_internal and human_curation_eligible_internal) as recommendation_eligible,
  couple_relevance,
  destination_appeal,
  current_appeal,
  distinctiveness,
  conversation_or_experience_value,
  repeat_commonness_risk,
  editorial_score,
  editorial_tier,
  editorial_rationale,
  editorial_reviewed_at,
  editorial_review_due_at,
  editorial_evidence_refs,
  editorial_gate_version,
  curation_origin,
  booking_required,
  booking_url,
  booking_open_at,
  booking_close_at,
  availability_status,
  availability_verified_at,
  availability_review_due_at,
  operational_eligible_internal as operational_eligible,
  editorial_eligible_internal as editorial_eligible,
  (
    operational_eligible_internal
    and editorial_eligible_internal
    and human_curation_eligible_internal
    and human_curation_status = 'keep_primary'
    and (editorial_tier = 'hero' or (editorial_tier = 'standard' and editorial_score >= 70))
  ) as primary_recommendation_eligible,
  (
    operational_eligible_internal
    and editorial_eligible_internal
    and human_curation_eligible_internal
  ) as alternative_recommendation_eligible,
  primary_activity_type,
  secondary_activity_types,
  human_curation_status,
  human_curation_reviewed_at,
  human_curation_gate_version,
  human_curation_eligible_internal as human_curation_eligible
from catalog;

revoke all on public.couple_recommendation_catalog from public, anon, authenticated;

comment on column public.couple_recommendation_items.human_curation_status is
  'Independent human eligibility gate: keep_primary, alternative_only, or fail-closed research_hold.';
comment on column public.couple_recommendation_items.human_curation_gate_version is
  'Categorical eligibility metadata only; never add this state to Editorial or Consensus scores.';
comment on view public.couple_recommendation_catalog is
  'Server-only Operational/Availability, Editorial, and Human Curation gate projection. Preference ranking happens afterwards.';
