# User word addition batch RPC integration test

The idempotent user word-addition batch RPC is defined by:

```text
supabase/migrations/20260824130000_user_word_addition_batches.sql
```

Run its behavior and deterministic concurrency tests only against the local
Supabase Docker stack:

```bash
supabase start
supabase migration up --local
npm run test:user-word-addition-batch-db
supabase stop
```

The browser gateway submits at most 300 normalized words per atomic RPC call.
Already committed word requests and theme relations are treated as unchanged,
so rerunning the same source file safely resumes after a failed later batch.

The pgTAP suites verify authentication and execute privileges, strict payload
and theme validation, all existing/new word branches, stable summary counts,
whole-batch rollback, replay idempotency, and serialization of overlapping
requests for the same word. Never use `--linked`, a project reference, or any
remote Supabase project for these tests. Always stop the local stack afterward.
