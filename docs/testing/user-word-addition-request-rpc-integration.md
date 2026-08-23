# User word addition request RPC integration test

The atomic authenticated-user word addition request RPC is defined by:

```text
supabase/migrations/20260824120000_user_word_addition_requests.sql
```

Run the behavior and real-session concurrency tests only against the local
Supabase Docker stack:

```bash
supabase start
supabase migration up --local
npm run test:user-word-addition-request-db
supabase stop
```

The test command runs the transactional pgTAP behavior suite and the separate
deterministic `dblink` concurrency suite. Together they verify input and theme
validation, authentication, privileges, rollback, the public result contract,
and exact-one behavior for overlapping requests for the same word.

Never use `--linked`, a project reference, or any remote Supabase project for
these tests. Always run `supabase stop` after the test session, whether the
migration or tests succeed or fail.
