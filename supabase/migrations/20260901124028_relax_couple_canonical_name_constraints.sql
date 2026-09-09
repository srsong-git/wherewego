-- Real Kakao/official venue and recommendation names can be a single
-- non-whitespace character (for example, "텅"). Keep empty or whitespace-only
-- names invalid while preserving the existing upper bounds.

alter table public.couple_venues
  drop constraint if exists couple_venues_canonical_name_check;

alter table public.couple_venues
  add constraint couple_venues_canonical_name_check
  check (
    length(btrim(canonical_name)) >= 1
    and length(btrim(canonical_name)) <= 120
  );

alter table public.couple_recommendation_items
  drop constraint if exists couple_recommendation_items_canonical_name_check;

alter table public.couple_recommendation_items
  add constraint couple_recommendation_items_canonical_name_check
  check (
    length(btrim(canonical_name)) >= 1
    and length(btrim(canonical_name)) <= 160
  );
