# User word request RPC integration test

The atomic authenticated-user word deletion request and cancellation RPCs are
defined by:

```text
supabase/migrations/20260823120000_user_word_requests.sql
```

Run the behavior and real-session concurrency tests only against the local
Supabase Docker stack:

```bash
supabase start
supabase migration up --local
npm run test:user-word-request-db
supabase stop
```

The test command runs the transactional pgTAP behavior suite and the separate
deterministic `dblink` concurrency suite.

Never use `--linked`, a project reference, or any remote Supabase project for
these tests. Always run `supabase stop` after the test session, whether the
migration or tests succeed or fail.
