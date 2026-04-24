-- Fix for Supabase advisory: rls_disabled_in_public on public.votes
-- Apply in Supabase SQL editor or via CLI migrations.

alter table if exists public.votes enable row level security;

-- No anon/authenticated policies are created on purpose.
-- All database access should go through server-side endpoints using the
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
