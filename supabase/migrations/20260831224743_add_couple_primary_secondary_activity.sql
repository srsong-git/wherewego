-- Couple Phase 1B-2A correctness: distinguish the purpose of a recommendation
-- from activities that are merely available at the same place.
--
-- `activity_traits` remains the ActivityPreferenceV1 coverage union. Consensus
-- scores use `primary_activity_type`; secondary activities are explanatory and
-- must not make a non-cafe destination fail the cafe veto.

alter table public.couple_recommendation_items
  add column if not exists primary_activity_type text,
  add column if not exists secondary_activity_types text[] not null default '{}'::text[];

update public.couple_recommendation_items
set primary_activity_type = case
  when category = 'cafe' then 'cafe'
  when category in ('exhibition', 'popup') then 'exhibition_popup'
  when category in ('experience', 'entertainment') then 'experience'
  when category = 'walk' then 'walk_culture'
  else activity_traits[1]
end
where primary_activity_type is null;

update public.couple_recommendation_items
set secondary_activity_types = array(
  select trait
  from unnest(activity_traits) as trait
  where trait <> primary_activity_type
)
where cardinality(secondary_activity_types) = 0
  and cardinality(activity_traits) > 1;

alter table public.couple_recommendation_items
  alter column primary_activity_type set not null;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_primary_activity_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_primary_activity_check
      check (primary_activity_type in ('cafe', 'exhibition_popup', 'experience', 'walk_culture'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.couple_recommendation_items'::regclass
      and conname = 'couple_recommendation_items_secondary_activities_check'
  ) then
    alter table public.couple_recommendation_items
      add constraint couple_recommendation_items_secondary_activities_check
      check (
        secondary_activity_types <@ array['cafe', 'exhibition_popup', 'experience', 'walk_culture']::text[]
        and not (primary_activity_type = any(secondary_activity_types))
        and primary_activity_type = any(activity_traits)
        and secondary_activity_types <@ activity_traits
        and activity_traits <@ array_prepend(primary_activity_type, secondary_activity_types)
      );
  end if;
end
$migration$;

comment on column public.couple_recommendation_items.primary_activity_type is
  'The main ActivityPreferenceV1 purpose. Cafe veto applies only when this value is cafe.';
comment on column public.couple_recommendation_items.secondary_activity_types is
  'Optional supporting activities; never sufficient by themselves to trigger an ActivityPreferenceV1 veto.';
