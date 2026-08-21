create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 30),
  child_reaction smallint not null check (child_reaction between 1 and 5),
  revisit_intent smallint not null check (revisit_intent between 1 and 3),
  child_age_group text not null check (child_age_group in ('유아', '초등 저학년', '초등 고학년')),
  content text not null check (char_length(content) between 10 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_place_user_unique unique (place_id, user_id)
);

create index if not exists reviews_place_created_idx
  on public.reviews (place_id, created_at desc);

alter table public.reviews enable row level security;

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

drop policy if exists "Reviews are readable by everyone" on public.reviews;
create policy "Reviews are readable by everyone"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Signed-in users can create their own reviews" on public.reviews;
create policy "Signed-in users can create their own reviews"
  on public.reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews"
  on public.reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews"
  on public.reviews
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
