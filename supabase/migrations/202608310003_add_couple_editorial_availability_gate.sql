-- Couple Phase 1B-1.5: fail-closed Editorial and Availability gates.
--
-- This migration is additive. It does not delete Couple or Family data and it
-- creates no dependency, view, trigger, or sync job between those domains.

alter table public.couple_recommendation_items
  add column if not exists couple_relevance smallint,
  add column if not exists destination_appeal smallint,
  add column if not exists current_appeal smallint,
  add column if not exists distinctiveness smallint,
  add column if not exists conversation_or_experience_value smallint,
  add column if not exists repeat_commonness_risk smallint,
  add column if not exists editorial_score smallint,
  add column if not exists editorial_tier text,
  add column if not exists editorial_rationale text,
  add column if not exists editorial_reviewed_at timestamptz,
  add column if not exists editorial_review_due_at timestamptz,
  add column if not exists editorial_evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists editorial_gate_version text,
  add column if not exists curation_origin text,
  add column if not exists booking_required boolean not null default false,
  add column if not exists booking_url text,
  add column if not exists booking_open_at timestamptz,
  add column if not exists booking_close_at timestamptz,
  add column if not exists availability_status text not null default 'unknown',
  add column if not exists availability_verified_at timestamptz,
  add column if not exists availability_review_due_at timestamptz;

-- The dashboard may apply this SQL before migration history is repaired. Make
-- constraint creation idempotent so a later CLI `db push` can safely replay it.
do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_editorial_scores_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_editorial_scores_check
      check (
        couple_relevance between 1 and 5
        and destination_appeal between 1 and 5
        and current_appeal between 1 and 5
        and distinctiveness between 1 and 5
        and conversation_or_experience_value between 1 and 5
        and repeat_commonness_risk between 1 and 5
        and editorial_score = couple_relevance * 6
          + destination_appeal * 4
          + current_appeal * 4
          + distinctiveness * 3
          + conversation_or_experience_value * 3
          - (repeat_commonness_risk - 1) * 5
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_editorial_tier_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_editorial_tier_check
      check (editorial_tier in ('hero', 'standard', 'coverage', 'reject')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_curation_origin_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_curation_origin_check
      check (curation_origin = 'independent_couple_research') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_editorial_lifecycle_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_editorial_lifecycle_check
      check (
        editorial_reviewed_at is not null
        and editorial_review_due_at > editorial_reviewed_at
        and length(btrim(editorial_rationale)) >= 20
        and jsonb_typeof(editorial_evidence_refs) = 'array'
        and jsonb_array_length(editorial_evidence_refs) > 0
        and length(btrim(editorial_gate_version)) > 0
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_availability_status_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_availability_status_check
      check (availability_status in (
        'available', 'limited', 'sold_out', 'registration_closed', 'walk_in_only', 'unknown'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_availability_lifecycle_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_availability_lifecycle_check
      check (
        (availability_verified_at is null and availability_review_due_at is null)
        or availability_review_due_at > availability_verified_at
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_booking_window_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_booking_window_check
      check (
        (booking_open_at is null or booking_close_at is null or booking_close_at > booking_open_at)
        and (not booking_required or booking_url is not null)
      ) not valid;
  end if;

  -- Existing unreviewed rows fail closed in the catalog. NOT VALID keeps the
  -- additive schema migration deployable before the reviewed pilot upsert while
  -- still enforcing this rule on every new or updated active Item.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_active_review_complete_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_active_review_complete_check
      check (
        status <> 'active'
        or (
          curation_origin = 'independent_couple_research'
          and editorial_tier in ('hero', 'standard', 'coverage')
          and editorial_score is not null
          and editorial_reviewed_at is not null
          and editorial_review_due_at is not null
          and jsonb_array_length(editorial_evidence_refs) > 0
          and editorial_gate_version is not null
          and availability_status <> 'unknown'
          and availability_verified_at is not null
          and availability_review_due_at is not null
        )
      ) not valid;
  end if;
end
$migration$;

create index if not exists couple_recommendation_items_editorial_candidate_idx
  on public.couple_recommendation_items (
    dataset_version, status, editorial_tier, editorial_score, availability_status
  );

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
    ) as editorial_eligible_internal
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
  (operational_eligible_internal and editorial_eligible_internal) as recommendation_eligible,
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
    and (editorial_tier = 'hero' or (editorial_tier = 'standard' and editorial_score >= 70))
  ) as primary_recommendation_eligible,
  (operational_eligible_internal and editorial_eligible_internal) as alternative_recommendation_eligible
from catalog;

revoke all on public.couple_recommendation_catalog from public, anon, authenticated;

comment on column public.couple_recommendation_items.curation_origin is
  'Active Couple Items must be independently researched; Family-derived identifiers are intentionally absent.';
comment on column public.couple_recommendation_items.editorial_score is
  'Eligibility metadata only. It must never be added to Preference or weighted Consensus scores.';
comment on column public.couple_recommendation_items.availability_status is
  'Reservation and walk-in availability. Closed, sold-out, stale, and unknown Items fail closed.';
comment on view public.couple_recommendation_catalog is
  'Server-only Operational/Availability and Couple Editorial gate projection. Preference ranking happens afterwards.';
