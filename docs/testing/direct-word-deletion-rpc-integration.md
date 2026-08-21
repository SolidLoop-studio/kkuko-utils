# Direct word deletion RPC integration test

The atomic administrator-only direct word deletion RPC is defined by:

```text
supabase/migrations/20260822120000_direct_word_deletion.sql
```

Run the behavior and real-session concurrency tests only against the local
Supabase Docker stack:

```bash
supabase start
supabase migration up --local
npm run test:direct-word-deletion-db
supabase stop
```

The test command runs the transactional pgTAP behavior suite and the separate
deterministic `dblink` concurrency suite.

Never use `--linked`, a project reference, or any remote Supabase project for
this test. Always run `supabase stop` after the test session, whether the
migration or tests succeed or fail.
