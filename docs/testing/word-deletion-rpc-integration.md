# Word deletion RPC integration tests

The word-deletion pgTAP suites exercise the four public deletion-operation RPCs
against a disposable local Supabase/PostgreSQL database. They are not mocked
gateway tests and must never target a linked, cloud, production, or otherwise
non-disposable database.

## Scope and prerequisites

The tests require Docker Desktop or Podman and the Supabase CLI. The local
database must contain the production-schema snapshot, the word-approval RPCs,
and the deletion migration. The concurrency suite also uses PostgreSQL's
`dblink` extension, creating it in the disposable database when needed.

Use only the local CLI target (`--local`). The following are forbidden test
targets:

- `--linked` commands;
- a production URL, project reference, or connection string;
- any database with data that must be preserved.

### Known fresh-reset blocker

Plain `npx supabase db reset --local` is currently blocked by the pre-existing
migration ordering: `20260820000000_add_word_approval_batch.sql` is encountered
before the later base-schema dump that supplies `public.users`. Do not work
around this by renaming, editing, deleting, or repairing cloud migration
history. Fresh-reset reproducibility remains a Phase 0A blocker.

For this disposable local test database only, use the controller-approved
bootstrap below. It restores the checked-in base dump, applies the approval
search-path migration, and repairs *local* migration history before applying
the pending deletion migration.

### Docker Desktop bootstrap

The following uses `docker cp` and `psql -f` instead of a PowerShell text pipe,
so the SQL files are copied byte-for-byte rather than being re-encoded by
Windows PowerShell 5.1.

```powershell
npx supabase start

docker cp supabase/migrations/20260820143308_remote_schema.sql supabase_db_kkuko-utils:/tmp/20260820143308_remote_schema.sql
docker exec supabase_db_kkuko-utils psql -U postgres -d postgres --set ON_ERROR_STOP=1 -f /tmp/20260820143308_remote_schema.sql

docker cp supabase/migrations/20260821000000_set_word_approval_batch_search_path.sql supabase_db_kkuko-utils:/tmp/20260821000000_set_word_approval_batch_search_path.sql
docker exec supabase_db_kkuko-utils psql -U postgres -d postgres --set ON_ERROR_STOP=1 -f /tmp/20260821000000_set_word_approval_batch_search_path.sql

npx supabase migration repair --local --status applied 20260820000000 20260820143308 20260821000000
npx supabase migration up --local

# Optional, only after both psql commands and migration up succeed.
docker exec supabase_db_kkuko-utils rm -f /tmp/20260820143308_remote_schema.sql /tmp/20260821000000_set_word_approval_batch_search_path.sql
```

### Podman bootstrap

Podman uses the same local container name and command arguments. Replace each
`docker` command above with the explicit equivalents below; do not mix the two
runtimes in one bootstrap.

```powershell
npx supabase start

podman cp supabase/migrations/20260820143308_remote_schema.sql supabase_db_kkuko-utils:/tmp/20260820143308_remote_schema.sql
podman exec supabase_db_kkuko-utils psql -U postgres -d postgres --set ON_ERROR_STOP=1 -f /tmp/20260820143308_remote_schema.sql

podman cp supabase/migrations/20260821000000_set_word_approval_batch_search_path.sql supabase_db_kkuko-utils:/tmp/20260821000000_set_word_approval_batch_search_path.sql
podman exec supabase_db_kkuko-utils psql -U postgres -d postgres --set ON_ERROR_STOP=1 -f /tmp/20260821000000_set_word_approval_batch_search_path.sql

npx supabase migration repair --local --status applied 20260820000000 20260820143308 20260821000000
npx supabase migration up --local

# Optional, only after both psql commands and migration up succeed.
podman exec supabase_db_kkuko-utils rm -f /tmp/20260820143308_remote_schema.sql /tmp/20260821000000_set_word_approval_batch_search_path.sql
```

This changes only the disposable local database and its local migration table;
it does not alter cloud migration history. The expected pending migration is
`20260821120000_add_word_deletion_batch.sql`.

## Run and cleanup

Run both suites after the bootstrap. Always stop the local stack in cleanup,
including after a failing command.

```powershell
npm run test:word-approval-db
npm run test:word-deletion-db
npx supabase stop
```

`test:word-approval-db` covers the approval regression suite (59 assertions).
`test:word-deletion-db` runs the deletion behavior and deterministic committed
session concurrency suites (121 assertions: 97 behavior and 24 concurrency).

## Fixture and assertion coverage

The suites use reserved UUIDs, words, docs rows, and temporary triggers so
their setup and cleanup are isolated to the disposable database. The behavior
suite runs its fixtures in a transaction and rolls them back; the concurrency
harness uses reserved identifiers and removes any fixture left by an interrupted
run before continuing.

Together, the tests verify:

- the four RPC signatures, authenticated `r4`/`admin` authorization,
  anonymous denial, grants, fixed trusted search paths, and RLS/no direct table
  access;
- input, operation, payload-hash, sequence, replay, cancellation, and conflict
  validation;
- actual deletion effects on words, moderation/docs logs, timestamps, requests,
  trigger-maintained statistics, and contributions (oldest whole-word deletion
  requester first, processing administrator as fallback);
- protected numeric-theme words and missing words produce their respective
  counters without unauthorized side effects;
- atomic rollback when a forced log failure occurs; and
- overlapping committed deletion batches delete a shared word and create
  associated side effects exactly once.

If bootstrap or test output differs, preserve the output, stop the local stack,
and investigate the local migration/fixture state. Do not redirect the tests to
a cloud project.
