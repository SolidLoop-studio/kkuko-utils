# Docs semantic-reference database integration tests

The docs semantic-reference database tests require Docker Desktop or Podman, with its container service running, and the Supabase CLI available through this repository's dependencies.

## Local-only environment

The local Supabase stack uses ports `55320` through `55329`. The default `54320` through `54329` range overlaps the Windows excluded port range on supported developer machines.

Only the disposable local Supabase stack is permitted. Cloud and linked databases are forbidden for these tests. Cloud rollout remains a separate operator action.

## Commands

Run the three docs-reference pgTAP files against an already running and reset local stack:

```bash
npm run test:docs-reference-db
```

For a complete disposable validation cycle, run:

```bash
npm run verify:local-db
```

This starts the local stack, checks its status, performs a fresh local reset, runs every database test under `supabase/tests`, and stops the stack during cleanup even when a preceding command fails.

## Coverage

The docs-reference suite covers trigger characterization, schema and resolver behavior, varying primary-key values, missing references, rollback behavior, search-path safety, and grants.
