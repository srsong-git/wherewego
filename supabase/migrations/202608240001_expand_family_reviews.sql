-- 부모가 실제 방문 난이도를 판단할 수 있도록 후기 항목을 확장합니다.
-- 기존 후기 데이터는 유지하며 새 항목은 중립값으로 채웁니다.

alter table public.reviews
  add column if not exists parking_difficulty text
    check (parking_difficulty in ('easy', 'normal', 'hard')),
  add column if not exists crowd_level text
    check (crowd_level in ('quiet', 'normal', 'crowded')),
  add column if not exists parent_fatigue_review text
    check (parent_fatigue_review in ('low', 'normal', 'high')),
  add column if not exists hard_points text[] not null default '{}'::text[]
    check (
      hard_points <@ array[
        '많이 걸어요',
        '대기 길어요',
        '주차 어려워요',
        '음식 비싸요',
        '초고학년은 심심해요',
        '저학년은 힘들어해요',
        '특별히 없어요'
      ]::text[]
      and cardinality(hard_points) <= 6
      and not ('특별히 없어요' = any(hard_points) and cardinality(hard_points) > 1)
    );

create or replace function public.get_public_reviews_v2(target_place_id text)
returns table (
  id uuid,
  place_id text,
  author_name text,
  child_reaction smallint,
  revisit_intent smallint,
  child_age_group text,
  parking_difficulty text,
  crowd_level text,
  parent_fatigue_review text,
  hard_points text[],
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
    review.parking_difficulty,
    review.crowd_level,
    review.parent_fatigue_review,
    review.hard_points,
    review.content,
    review.created_at,
    review.updated_at
  from public.reviews as review
  where review.place_id = target_place_id
  order by review.created_at desc;
$$;

revoke all on function public.get_public_reviews_v2(text) from public;
grant execute on function public.get_public_reviews_v2(text) to anon, authenticated;

notify pgrst, 'reload schema';
