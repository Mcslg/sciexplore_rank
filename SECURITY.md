# Security hardening notes

## Supabase `votes` table: RLS remediation

This repo includes `supabase/migrations/20260422_enable_rls_votes.sql` to address the Supabase advisory:

- **Issue ID:** `rls_disabled_in_public`
- **Project:** `sciexplore` (`bazcoiuhgbgyyhfggjhv`)
- **Table:** `public.votes`

### Required deployment changes

1. Run the SQL migration to **enable Row-Level Security** on `public.votes`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment for API routes.
3. Set `CRON_SECRET` in the deployment environment and include it when calling `/api/track`.
4. (Optional) Set `SUPABASE_URL` if using a non-default project URL.

### Cron endpoint protection

`/api/track` fetches the latest official data and writes a new snapshot to Supabase. It requires `CRON_SECRET` so public visitors cannot trigger extra snapshots.

Call it with either:

```txt
/api/track?secret=your-random-cron-secret
```

or:

```txt
Authorization: Bearer your-random-cron-secret
```

### Why this works

- RLS prevents direct anonymous/public table reads/writes.
- API routes now use the service role key server-side, so the app keeps functioning without exposing table access publicly.
- `/api/track` requires a cron secret before it fetches and stores a new vote snapshot.
