-- 공개 베타 운영을 위한 개인정보 최소화, 신고, 탈퇴 요청, 도배 방지 설정

-- 공개 후기에는 작성자의 인증 UUID를 포함하지 않습니다.
drop policy if exists "Reviews are readable by everyone" on public.reviews;
revoke select on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

drop policy if exists "Users can read their own review" on public.reviews;
create policy "Users can read their own review"
  on public.reviews
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.get_public_reviews(target_place_id text)
returns table (
  id uuid,
  place_id text,
  author_name text,
  child_reaction smallint,
  revisit_intent smallint,
  child_age_group text,
  content text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.id,
    review.place_id,
    review.author_name,
    review.child_reaction,
    review.revisit_intent,
    review.child_age_group,
    review.content,
    review.created_at,
    review.updated_at
  from public.reviews as review
  where review.place_id = target_place_id
  order by review.created_at desc;
$$;

revoke all on function public.get_public_reviews(text) from public;
grant execute on function public.get_public_reviews(text) to anon, authenticated;

-- 한 계정이 여러 장소에 짧은 시간 동안 연속으로 후기를 등록하는 것을 제한합니다.
create or replace function public.enforce_review_write_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.reviews
      where user_id = new.user_id
        and updated_at > now() - interval '20 seconds'
    ) then
      raise exception '후기는 20초에 한 번만 저장할 수 있습니다.';
    end if;
  elsif old.updated_at > now() - interval '20 seconds' then
    raise exception '후기는 20초에 한 번만 저장할 수 있습니다.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_write_cooldown on public.reviews;
create trigger reviews_write_cooldown
  before insert or update on public.reviews
  for each row execute function public.enforce_review_write_cooldown();

-- 로그인 사용자는 다른 사용자의 후기를 한 번만 신고할 수 있습니다.
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('개인정보 노출', '광고 또는 도배', '욕설 또는 부적절한 내용', '사실과 다른 정보', '기타')),
  details text not null default '' check (char_length(details) <= 300),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint review_reports_review_reporter_unique unique (review_id, reporter_id)
);

create index if not exists review_reports_status_created_idx
  on public.review_reports (status, created_at desc);

alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;
grant select, insert on public.review_reports to authenticated;

create or replace function public.can_report_review(target_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews
    where reviews.id = target_review_id
      and reviews.user_id <> auth.uid()
  );
$$;

revoke all on function public.can_report_review(uuid) from public;
grant execute on function public.can_report_review(uuid) to authenticated;

drop policy if exists "Users can create their own reports" on public.review_reports;
create policy "Users can create their own reports"
  on public.review_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and public.can_report_review(review_id)
  );

drop policy if exists "Users can read their own reports" on public.review_reports;
create policy "Users can read their own reports"
  on public.review_reports
  for select
  to authenticated
  using ((select auth.uid()) = reporter_id);

-- 탈퇴 요청은 사용자 본인만 만들고 확인할 수 있습니다.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  requested_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists "Users can read their own deletion request" on public.account_deletion_requests;
create policy "Users can read their own deletion request"
  on public.account_deletion_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  delete from public.reviews where user_id = requesting_user_id;

  insert into public.account_deletion_requests (user_id, status, requested_at)
  values (requesting_user_id, 'pending', now())
  on conflict (user_id) do update
    set status = 'pending', requested_at = excluded.requested_at;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
