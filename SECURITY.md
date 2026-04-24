# Security hardening notes

## Supabase `votes` table: RLS remediation

This repo includes `supabase/migrations/20260422_enable_rls_votes.sql` to address the Supabase advisory:

- **Issue ID:** `rls_disabled_in_public`
- **Project:** `sciexplore` (`bazcoiuhgbgyyhfggjhv`)
- **Table:** `public.votes`

### Required deployment changes

1. Run the SQL migration to **enable Row-Level Security** on `public.votes`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment for API routes.
3. (Optional) Set `SUPABASE_URL` if using a non-default project URL.

### Why this works

- RLS prevents direct anonymous/public table reads/writes.
- API routes now use the service role key server-side, so the app keeps functioning without exposing table access publicly.
