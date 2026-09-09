-- Run with `supabase test db` after applying all migrations.
begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select ok(
  has_table_privilege('authenticated', 'public.decision_sessions', 'SELECT'),
  'participants may receive session row updates through RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.session_invites', 'SELECT'),
  'invite secret hashes are never client-readable'
);

select ok(
  not has_table_privilege('authenticated', 'public.session_participants', 'SELECT'),
  'participant UUIDs are never client-readable'
);

select ok(
  not has_table_privilege('authenticated', 'public.preference_responses', 'SELECT'),
  'raw preference responses are never client-readable'
);

select ok(
  not has_table_privilege('authenticated', 'public.recommendation_results', 'SELECT'),
  'result tables are exposed only through the safe state RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.recommendation_result_items', 'SELECT'),
  'result snapshots are exposed only through the safe state RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.create_decision_session(text)', 'EXECUTE'),
  'authenticated anonymous users can create a session'
);

select ok(
  has_function_privilege('authenticated', 'public.join_decision_session(text,text)', 'EXECUTE'),
  'authenticated anonymous users can join with a secret'
);

select ok(
  has_function_privilege('authenticated', 'public.resume_decision_session(text)', 'EXECUTE'),
  'participants can resume on refresh'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_preference_response(uuid,text,jsonb)', 'EXECUTE'),
  'participants can submit through the validated RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.get_decision_session_state(uuid)', 'EXECUTE'),
  'participants can read safe session state'
);

select ok(
  not has_function_privilege('authenticated', 'public.complete_decision_session(uuid,jsonb)', 'EXECUTE'),
  'clients cannot write recommendation results'
);

select ok(
  has_function_privilege('service_role', 'public.complete_decision_session(uuid,jsonb)', 'EXECUTE'),
  'only the finalizer service role can complete a session'
);

select ok(
  not has_table_privilege('anon', 'public.couple_recommendation_catalog', 'SELECT'),
  'anonymous users cannot read the production Couple catalog'
);

select ok(
  not has_table_privilege('authenticated', 'public.couple_recommendation_catalog', 'SELECT'),
  'authenticated browser users cannot read the production Couple catalog'
);

select ok(
  not has_table_privilege('anon', 'public.couple_venues', 'SELECT')
    and not has_table_privilege('anon', 'public.couple_recommendation_items', 'SELECT'),
  'anonymous users cannot read the production Couple base tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.couple_venues', 'SELECT')
    and not has_table_privilege('authenticated', 'public.couple_recommendation_items', 'SELECT'),
  'authenticated browser users cannot read the production Couple base tables'
);

select ok(
  has_table_privilege('service_role', 'public.couple_recommendation_catalog', 'SELECT')
    and has_table_privilege('service_role', 'public.couple_venues', 'SELECT')
    and has_table_privilege('service_role', 'public.couple_recommendation_items', 'SELECT'),
  'only the service role receives catalog read privileges for finalization'
);

select ok(
  pg_get_functiondef('public.complete_decision_session(uuid,jsonb)'::regprocedure)
    like '%recommendation_item_id%'
    and pg_get_functiondef('public.complete_decision_session(uuid,jsonb)'::regprocedure)
    like '%INVALID_PUBLIC_PLACE_SNAPSHOT%',
  'finalization stores the production item reference while enforcing a public snapshot allowlist'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'decision_sessions'
      and policyname = 'Participants can read their decision session'
      and qual like '%is_session_participant%'
  ),
  'third-party decision session reads are blocked by participant RLS'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'Permanent users can create their own reviews'
      and with_check like '%current_user_is_permanent%'
  ),
  'anonymous users cannot create family reviews'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'review_reports'
      and policyname = 'Permanent users can create their own reports'
      and with_check like '%current_user_is_permanent%'
  ),
  'anonymous users cannot report family reviews'
);

select ok(
  pg_get_functiondef('public.request_account_deletion()'::regprocedure) like '%is_anonymous%',
  'anonymous users cannot request account deletion'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'decision_sessions'
  ),
  'decision session status is published for Realtime'
);

select * from finish();
rollback;
