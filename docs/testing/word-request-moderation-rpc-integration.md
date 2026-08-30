# Word request moderation RPC integration test

The atomic word-request moderation RPCs are defined by:

```text
supabase/migrations/20260821130000_admin_word_request_moderation.sql
```

Run the integration tests only against the local Supabase Docker stack:

```bash
supabase start
npm run test:word-request-moderation-db
supabase stop
```

The npm command runs both the transactional pgTAP behavior suite and the
separate real-session `dblink` concurrency suite.

The local database migration history can outlive a branch or worktree. If
`supabase migration up --local` reports a migration version that is absent
from the current worktree, reconcile only the local migration history before
testing. Do not weaken assertions or redirect the tests to another database.
A full local reset can destroy unrelated local development data and should not
be used without explicit approval.

Never use `--linked`, a project reference, or any remote Supabase project as
the target of these tests. Always run `supabase stop` after the test session,
including after failures.
