# Word deletion RPC cloud rollout

This is an operator handoff for applying
`20260821120000_add_word_deletion_batch.sql`. This implementation session did
not contact, link, migrate, repair, push to, or smoke-test any cloud Supabase
project. Cloud rollout remains pending user/operator execution.

Do not place project references, access tokens, passwords, connection strings,
or backup artifacts in this document or in source control. Complete each
checkpoint before moving to the next phase; stop on an unexpected result.

## 1. Identify the intended project (read-only)

In an operator-controlled shell, list accessible projects and separately inspect
the existing local link metadata. Listing or reading metadata must not change
the link.

```powershell
npx supabase projects list
Get-Content -Raw supabase/.temp/project-ref
```

Checkpoint: the operator independently confirms that the displayed project and
the existing link metadata identify the intended environment. If the metadata is
missing or differs, stop; do not run `supabase link` as part of this rollout
until the discrepancy is resolved through the team's normal change process.

## 2. Back up first

Create and verify a cloud database backup using the team's approved Supabase
backup process. Record its timestamp, retention location, restore owner, and
restore procedure outside this repository.

Checkpoint: a verified, restorable pre-rollout backup exists. Do not continue
without it.

## 3. Resolve migration history before any write

First inspect remote history read-only, then compare it with local migration
files:

```powershell
npx supabase migration list --linked
Get-ChildItem supabase/migrations -File | Select-Object -ExpandProperty Name
```

Checkpoint: explicitly resolve or confirm the pre-existing baseline ordering
and history involving `20260820000000_add_word_approval_batch.sql`,
`20260820143308_remote_schema.sql`, and
`20260821000000_set_word_approval_batch_search_path.sql`. Do not repair,
rename, delete, or otherwise rewrite applied cloud history to make a fresh-local
bootstrap work.

## 4. Review the proposed change

Generate a read-only schema diff through the team's approved connected-project
review workflow (for example, after the project identity checkpoint):

```powershell
npx supabase db diff --linked --schema public
```

Review `supabase/migrations/20260821120000_add_word_deletion_batch.sql` line by
line. Check that the intended cloud change is limited to these deletion objects:

- `word_deletion_operations` and `word_deletion_batches`, their RLS, constraints,
  and the running-input index;
- `start_word_deletion_operation`, `get_word_deletion_operation`,
  `apply_word_deletion_batch`, and `cancel_word_deletion_operation`;
- function ownership/security settings and EXECUTE grants/revocations required
  for those four RPCs.

Checkpoint: no unrelated tables, functions, policies, grants, indexes, or
historical migrations are included. Resolve any difference before deployment.

## 5. Apply through the approved workflow

Use the team's approved cloud migration workflow to apply exactly
`20260821120000_add_word_deletion_batch.sql`. If that workflow uses the CLI,
manually repeat the project-identity and migration-list checkpoints immediately
before the write, then run:

```powershell
npx supabase db push
```

Checkpoint: the CLI's migration list shows the deletion migration as the only
new applied migration and reports success. Do not use `--include-all`, do not
run a migration repair against cloud history, and do not modify an applied file.

## 6. Validate the deployed database

Using the team's approved read-only SQL-console or database-client connection,
run the following inspection query. It contains no credentials and is safe to
store; the connection configuration itself must remain outside source control.

```sql
with expected_functions (expected_signature, function_oid) as (
    values
        (
            'public.start_word_deletion_operation(uuid,text,integer,integer)',
            to_regprocedure('public.start_word_deletion_operation(uuid,text,integer,integer)')
        ),
        (
            'public.get_word_deletion_operation(uuid)',
            to_regprocedure('public.get_word_deletion_operation(uuid)')
        ),
        (
            'public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)',
            to_regprocedure('public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb)')
        ),
        (
            'public.cancel_word_deletion_operation(uuid)',
            to_regprocedure('public.cancel_word_deletion_operation(uuid)')
        )
)
select
    expected.expected_signature,
    p.oid::regprocedure as actual_signature,
    p.prosecdef,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from expected_functions as expected
left join pg_proc as p on p.oid = expected.function_oid
order by expected.expected_signature;

select
    c.relname,
    c.relrowsecurity as rls_enabled,
    count(pol.polname) as policy_count
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
left join pg_policy as pol on pol.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('word_deletion_operations', 'word_deletion_batches')
group by c.relname, c.relrowsecurity
order by c.relname;
```

Checkpoint: all four exact signatures exist; each is `SECURITY DEFINER` with
the fixed trusted search path; `anon` cannot execute; `authenticated` can
execute; both operation tables have RLS enabled and no direct-access policy.

## 7. Authenticated administrator smoke test

With a deliberately disposable test word and an authenticated `r4` or `admin`
account, run a complete one-batch operation through the application or approved
operator test path. Record the operation ID. Confirm the intended effects:

- the disposable word is removed;
- one moderation log and applicable docs logs are created;
- the selected requester (or the processing administrator when no requester
  exists) receives the expected contribution;
- affected docs timestamps and request cleanup reflect only the deleted word.

Checkpoint: clean up the disposable test data through the approved operator
procedure and verify it is gone. Do not perform this smoke test against a
non-disposable real user word without explicit operational approval.

## 8. Monitor and diagnose

Monitor Postgres logs and application errors after rollout for
`WORD_DELETION_INTERNAL_ERROR`. Preserve the operation ID, timestamp, actor,
batch index, public error code, and relevant server-side log correlation data
before taking corrective action. Do not expose SQL exception text to end users.

## 9. Roll back only by moving forward

If rollback is required, create a new reviewed forward migration. In dependency
order, it must revoke and drop the four public deletion RPCs, then drop the
private helpers `private.word_deletion_operation_result(uuid)` and
`private.assert_word_deletion_admin()`, then drop `word_deletion_batches`, and
finally drop `word_deletion_operations` (and its remaining indexes). Do not drop
the shared `private` schema. Apply the forward migration through the same
approved migration workflow.

Never edit, delete, rename, or reverse an already applied migration, and never
use cloud migration repair to undo this rollout.
