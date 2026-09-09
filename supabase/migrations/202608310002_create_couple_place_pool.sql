-- Couple Phase 1B-1: production place-pool model.
--
-- Physical Kakao places live in couple_venues. A recommendable permanent
-- destination or dated event lives in couple_recommendation_items. This keeps
-- kakao_place_id unique to a physical venue while allowing multiple events at
-- the same venue.

create table if not exists public.couple_venues (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  canonical_name text not null check (length(btrim(canonical_name)) between 2 and 120),
  address text not null check (length(btrim(address)) between 5 and 240),
  latitude numeric(10, 7) not null check (latitude between 33 and 39),
  longitude numeric(10, 7) not null check (longitude between 124 and 132),
  kakao_place_id text not null unique check (kakao_place_id ~ '^[0-9]+$'),
  kakao_detail_url text not null,
  meeting_area text not null check (meeting_area in ('seongsu', 'hongdae', 'jongno_euljiro')),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  verified_at timestamptz not null,
  source_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_references) = 'array' and jsonb_array_length(source_references) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kakao_detail_url = 'https://place.map.kakao.com/' || kakao_place_id)
);

create table if not exists public.couple_recommendation_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^[a-z0-9][a-z0-9_-]{2,99}$'),
  venue_id uuid not null references public.couple_venues(id) on delete restrict,
  item_kind text not null check (item_kind in ('permanent', 'event')),
  canonical_name text not null check (length(btrim(canonical_name)) between 2 and 160),
  summary text not null check (length(btrim(summary)) between 10 and 400),
  category text not null check (
    category in ('cafe', 'exhibition', 'popup', 'experience', 'entertainment', 'culture', 'walk', 'restaurant')
  ),
  activity_traits text[] not null check (
    cardinality(activity_traits) between 1 and 4
    and activity_traits <@ array['cafe', 'exhibition_popup', 'experience', 'walk_culture']::text[]
  ),
  energy_level text not null check (energy_level in ('low', 'medium', 'high')),
  novelty_level text not null check (novelty_level in ('proven', 'balanced', 'new')),
  freshness_class text not null check (freshness_class in ('evergreen', 'recent', 'temporary')),
  freshness_reason text not null check (length(btrim(freshness_reason)) between 8 and 400),
  freshness_verified_at timestamptz not null,
  freshness_review_due_at timestamptz not null,
  freshness_expires_at timestamptz,
  price_band text not null check (
    price_band in ('free', 'under_20000', 'under_40000', 'over_40000', 'variable')
  ),
  typical_spend_per_person integer not null default 0 check (typical_spend_per_person >= 0),
  required_spend_per_person integer not null default 0 check (required_spend_per_person >= 0),
  price_basis text not null check (
    price_basis in ('free', 'admission', 'minimum_purchase', 'optional_purchase', 'program_fee', 'variable')
  ),
  price_note text not null check (length(btrim(price_note)) between 2 and 240),
  recommended_duration_minutes smallint not null check (recommended_duration_minutes between 30 and 720),
  indoor_outdoor text not null check (indoor_outdoor in ('indoor', 'outdoor', 'mixed')),
  walking_level text not null check (walking_level in ('low', 'medium', 'high')),
  wait_risk text not null check (wait_risk in ('low', 'medium', 'high')),
  car_required boolean not null default false,
  mobility_score numeric(2, 1) check (mobility_score between 0 and 5),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  valid_from timestamptz,
  valid_until timestamptz,
  verified_at timestamptz not null,
  source_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_references) = 'array' and jsonb_array_length(source_references) > 0),
  dataset_kind text not null default 'production' check (dataset_kind = 'production'),
  dataset_version text not null default 'couple-production-pilot-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (freshness_review_due_at > freshness_verified_at),
  check (freshness_expires_at is null or freshness_expires_at > freshness_verified_at),
  check (freshness_class <> 'recent' or freshness_expires_at is not null),
  check (freshness_class <> 'temporary' or (freshness_expires_at is not null and valid_until is not null)),
  check (item_kind <> 'event' or (valid_from is not null and valid_until is not null)),
  check (
    price_band <> 'free'
    or (typical_spend_per_person = 0 and required_spend_per_person = 0 and price_basis = 'free')
  ),
  check (typical_spend_per_person >= required_spend_per_person)
);

create index if not exists couple_venues_area_status_idx
  on public.couple_venues (meeting_area, status);
create index if not exists couple_recommendation_items_candidate_idx
  on public.couple_recommendation_items (status, dataset_version, valid_from, valid_until);
create index if not exists couple_recommendation_items_venue_idx
  on public.couple_recommendation_items (venue_id);
create index if not exists couple_recommendation_items_traits_idx
  on public.couple_recommendation_items using gin (activity_traits);

-- This view centralizes time-sensitive eligibility. A stale `recent` item is
-- demoted from `new` to `balanced`; an expired temporary item is ineligible.
create or replace view public.couple_recommendation_catalog
with (security_invoker = true)
as
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
  case
    when item.freshness_review_due_at <= now()
      or (item.freshness_expires_at is not null and item.freshness_expires_at <= now())
      then 'stale'
    else item.freshness_class
  end as freshness_state,
  case
    when item.novelty_level = 'new'
      and (
        item.freshness_review_due_at <= now()
        or (item.freshness_expires_at is not null and item.freshness_expires_at <= now())
      )
      then 'balanced'
    else item.novelty_level
  end as effective_novelty_level,
  (
    venue.status = 'active'
    and item.status = 'active'
    and (item.valid_from is null or item.valid_from <= now())
    and (item.valid_until is null or item.valid_until > now())
    and (
      item.freshness_class <> 'temporary'
      or (item.freshness_expires_at is not null and item.freshness_expires_at > now())
    )
  ) as recommendation_eligible
from public.couple_recommendation_items as item
join public.couple_venues as venue on venue.id = item.venue_id;

alter table public.couple_venues enable row level security;
alter table public.couple_recommendation_items enable row level security;

-- The production pool is server-managed. Anonymous and permanent browser
-- sessions both stay behind RPC/Edge Function snapshots.
revoke all on public.couple_venues, public.couple_recommendation_items from public, anon, authenticated;
revoke all on public.couple_recommendation_catalog from public, anon, authenticated;

-- Preserve Phase 1A fixture snapshots while allowing a future production
-- result to reference the exact versioned recommendation item.
alter table public.recommendation_result_items
  add column if not exists recommendation_item_id uuid
  references public.couple_recommendation_items(id) on delete restrict;

create index if not exists recommendation_result_items_recommendation_item_idx
  on public.recommendation_result_items (recommendation_item_id);

comment on table public.couple_venues is
  'Physical places with Kakao identity. kakao_place_id is never an event/item key.';
comment on table public.couple_recommendation_items is
  'Permanent destinations and dated events. Multiple items may reference one venue.';
comment on column public.couple_recommendation_items.freshness_expires_at is
  'After this time, recent items lose newness and temporary items are not recommendable.';
comment on column public.couple_recommendation_items.required_spend_per_person is
  'Minimum unavoidable per-person charge; zero when purchase or admission is optional.';
comment on view public.couple_recommendation_catalog is
  'Server-only eligibility projection. Images are intentionally deferred until a rights-approved media model exists.';
