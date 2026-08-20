# Word approval RPC integration tests

The tests in `supabase/tests/database` execute the deployed word-approval functions against a
real PostgreSQL/Supabase database. They cover committed business effects, forced transactional
rollback, same-hash replay, different-hash conflict, cancellation, authorization, and overlapping
concurrent starts.

These tests are intentionally separate from the normal Jest CI suite and contain no conditional
skip. Unless CI explicitly runs the command below against a prepared disposable database, real
database transaction behavior remains unverified; mocked Supabase gateway calls are not presented
as a substitute.

## Prerequisites

Use only a disposable local Supabase database. Never use `--linked`, a production connection
string, or a database containing data that must be preserved.

The disposable database must contain the current Kkuko Utils base schema and functions, including
`users`, `themes`, `words`, moderation request/log tables, `increment_contribution`, and
`update_last_updates`. It must also have
`supabase/migrations/20260820000000_add_word_approval_batch.sql` applied. This repository currently
does not contain the earlier production schema migrations or a schema fixture, so `supabase db
reset` from this checkout alone cannot construct that prerequisite database.

Docker Desktop or Podman must be installed and running because the local Supabase CLI uses
containers. The concurrency test also needs the PostgreSQL `dblink` extension; the test creates it
in the disposable database if necessary.

## Run

After restoring the current application schema into the local Supabase database and applying the
word-approval migration, run from the repository root:

```bash
npm run test:word-approval-db
```

This expands to:

```bash
supabase test db --local \
  supabase/tests/database/word-approval-batch.integration.sql \
  supabase/tests/database/word-approval-concurrency.integration.sql
```

The command must exit nonzero if the database is unavailable, its schema is incomplete, an RPC
behavior differs, or the concurrency extension/connection cannot run. Do not replace those
failures with conditional skips.

The behavior test runs its fixtures in a transaction and rolls them back. The concurrency test
uses separate committed `dblink` sessions and therefore creates uniquely named test rows and a
short-lived trigger; it removes those objects before finishing. Run it only against the disposable
database described above.
