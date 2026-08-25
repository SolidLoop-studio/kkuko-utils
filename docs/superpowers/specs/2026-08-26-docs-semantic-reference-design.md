# Docs Semantic Reference Design

## Status and scope

This document is the binding design for Phase 0B of the DDD-lite migration roadmap and for the immediately following `WordsDocsHome` vertical slice. Phase 0B replaces database business rules that currently treat `docs.id` values as domain constants. The UI slice then replaces the last `WordsDocsHome.tsx` calls to `SCM.get().letterDocs()` and `SCM.add().waitDocs()`.

The implementation is forward-only. It must not edit `supabase/migrations/20260820143308_remote_schema.sql` or any other migration that may already be recorded remotely, manually edit `src/app/types/database.types.ts`, execute `supabase db push`, use `--linked`, or otherwise mutate a cloud Supabase project. Cloud rollout remains explicitly controlled by the user/operator.

The following are outside this slice:

- changing the public meaning of long-word or mission-word docs;
- renumbering production docs rows;
- making `reference_code` mandatory for normal docs;
- migrating unrelated remaining SCM consumers;
- changing the `WordsDocsHome` layout, Korean copy, login modal, completion modal, or three-second inline error behavior;
- introducing a generic docs repository or a mandatory Next.js Route Handler.

## Evidence and current behavior

The checked-in baseline, seed, database tests, docs module, and presentation tests establish these facts:

- `supabase/migrations/20260820143308_remote_schema.sql` defines three `SECURITY DEFINER` trigger functions with numeric docs IDs and no hardened search path:
  - `public.words_docs_logs_trg()` records Korean long-word logs in docs `201` and `202` on qualifying word insert/delete and on transitions into or out of `k_canuse = true AND length >= 9`.
  - `public.fn_process_word_docs_update()` records mission logs for each of `가나다라마바사아자차카타파하`; every word length uses the word-chain and reverse-word-chain children, while only length three additionally uses Kkungkkungtta children.
  - `public.sync_parent_last_update()` propagates a mission child `last_update` change from `209..222`, `224..237`, or `239..252` to parent `208`, `223`, or `238`.
- `fn_process_word_docs_update()` is an `AFTER INSERT OR DELETE` word trigger. It does not inspect `k_canuse`, it creates at most one log per contained mission character and category even when that character occurs more than once, and it does not run on word update.
- `words_docs_logs_trg()` is an `AFTER INSERT OR DELETE OR UPDATE` word trigger. For an update that changes long-word eligibility it records `NEW.word` and `NEW.added_by`, including a transition out of eligibility.
- A missing numeric docs row currently causes a `docs_logs_docs_id_fkey` failure. Because all trigger effects share the initiating word statement or RPC transaction, the word change and earlier trigger effects roll back.
- `supabase/seed.sql` is the active local seed configured by `supabase/config.toml`. It inserts the production IDs and names shown below. `supabase/data/docs.csv` mirrors the source data but is not referenced by local bootstrap configuration.
- `WordsDocsHome.tsx` already uses `usePendingDocsRequests().refetch()` for the pending-request duplicate check. It still loads every letter docs row through `SCM.get().letterDocs()` and inserts `docs_wait` through `SCM.add().waitDocs()`.
- `src/__tests__/words-docs/WordsDocsHome.test.tsx` fixes the pending-request duplicate and pending-query error messages. The component also currently shows `LoginRequiredModal`, `CompleteModal`, and an inline request modal.

The current local Supabase ports `54320..54329` overlap a Windows excluded TCP range. The repository-local configuration must move the corresponding ports to `55320..55329` before database tests can run. This is local configuration only and is not a cloud database change.

## Semantic reference catalog

`docs.id` remains a generated surrogate primary key. The following `reference_code` values are the immutable business identifiers.

### Fixed references

| Current production ID | Actual role | Stable `reference_code` |
| ---: | --- | --- |
| 201 | Korean word-chain long words | `ko.word-chain.long` |
| 202 | Korean reverse-word-chain long words | `ko.reverse-word-chain.long` |
| 208 | Korean word-chain mission parent | `ko.word-chain.mission` |
| 223 | Korean reverse-word-chain mission parent | `ko.reverse-word-chain.mission` |
| 238 | Korean Kkungkkungtta mission parent | `ko.kkungkkungtta.mission` |

### Mission-character romanization and child references

The romanization keys are deliberately simple, ASCII-only, and unambiguous. They are not a general Korean romanization system; they are stable keys for this finite domain catalog.

| Order | Character | Key | Word-chain ID / code | Reverse-word-chain ID / code | Kkungkkungtta ID / code |
| ---: | --- | --- | --- | --- | --- |
| 1 | 가 | `ga` | 209 / `ko.word-chain.mission.ga` | 224 / `ko.reverse-word-chain.mission.ga` | 239 / `ko.kkungkkungtta.mission.ga` |
| 2 | 나 | `na` | 210 / `ko.word-chain.mission.na` | 225 / `ko.reverse-word-chain.mission.na` | 240 / `ko.kkungkkungtta.mission.na` |
| 3 | 다 | `da` | 211 / `ko.word-chain.mission.da` | 226 / `ko.reverse-word-chain.mission.da` | 241 / `ko.kkungkkungtta.mission.da` |
| 4 | 라 | `ra` | 212 / `ko.word-chain.mission.ra` | 227 / `ko.reverse-word-chain.mission.ra` | 242 / `ko.kkungkkungtta.mission.ra` |
| 5 | 마 | `ma` | 213 / `ko.word-chain.mission.ma` | 228 / `ko.reverse-word-chain.mission.ma` | 243 / `ko.kkungkkungtta.mission.ma` |
| 6 | 바 | `ba` | 214 / `ko.word-chain.mission.ba` | 229 / `ko.reverse-word-chain.mission.ba` | 244 / `ko.kkungkkungtta.mission.ba` |
| 7 | 사 | `sa` | 215 / `ko.word-chain.mission.sa` | 230 / `ko.reverse-word-chain.mission.sa` | 245 / `ko.kkungkkungtta.mission.sa` |
| 8 | 아 | `a` | 216 / `ko.word-chain.mission.a` | 231 / `ko.reverse-word-chain.mission.a` | 246 / `ko.kkungkkungtta.mission.a` |
| 9 | 자 | `ja` | 217 / `ko.word-chain.mission.ja` | 232 / `ko.reverse-word-chain.mission.ja` | 247 / `ko.kkungkkungtta.mission.ja` |
| 10 | 차 | `cha` | 218 / `ko.word-chain.mission.cha` | 233 / `ko.reverse-word-chain.mission.cha` | 248 / `ko.kkungkkungtta.mission.cha` |
| 11 | 카 | `ka` | 219 / `ko.word-chain.mission.ka` | 234 / `ko.reverse-word-chain.mission.ka` | 249 / `ko.kkungkkungtta.mission.ka` |
| 12 | 타 | `ta` | 220 / `ko.word-chain.mission.ta` | 235 / `ko.reverse-word-chain.mission.ta` | 250 / `ko.kkungkkungtta.mission.ta` |
| 13 | 파 | `pa` | 221 / `ko.word-chain.mission.pa` | 236 / `ko.reverse-word-chain.mission.pa` | 251 / `ko.kkungkkungtta.mission.pa` |
| 14 | 하 | `ha` | 222 / `ko.word-chain.mission.ha` | 237 / `ko.reverse-word-chain.mission.ha` | 252 / `ko.kkungkkungtta.mission.ha` |

This catalog contains 47 system references: two long-word docs, three mission parents, and 42 mission children.

## Considered approaches

### Keep numeric IDs and improve comments

This preserves the present implementation but does not make fresh environments or restored datasets safe. Creation order remains a business precondition, and tests cannot prove behavior with different primary keys. It is rejected.

### Resolve by mutable Korean docs name

Names already identify the production rows and would avoid numeric constants. However, names are display content, can be edited, and contain language-specific presentation wording. Treating them as keys would merely exchange one hidden coupling for another. It is rejected as the runtime contract, although exact names are used as a safety check during the one-time backfill.

### Add a nullable immutable semantic code

A dedicated `reference_code` cleanly separates the generated primary key, display name, and stable business role. A nullable unique column lets the 47 system docs opt into the contract without inventing keys for ordinary user-created docs. A small private resolver keeps trigger code explicit and makes missing reference data fail predictably. This is the selected design.

An explicit relationship table was also considered. The current relationships are a finite set of named singleton roles, not user-managed many-to-many data, so a second table would add joins and lifecycle rules without adding useful flexibility.

## Schema contract

The first forward migration is `supabase/migrations/20260826090000_add_docs_reference_codes.sql`. It adds:

```sql
alter table public.docs
    add column reference_code text;

alter table public.docs
    add constraint docs_reference_code_format_check
    check (
        reference_code is null
        or reference_code ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'
    );

alter table public.docs
    add constraint docs_reference_code_key unique (reference_code);
```

PostgreSQL's ordinary unique constraint permits multiple nulls, so normal docs do not contend for a synthetic code. `reference_code` is nullable by design, not as a transitional shortcut.

The same migration creates `private.enforce_docs_reference_code_immutable()` and the `BEFORE UPDATE OF reference_code` trigger `trg_docs_reference_code_immutable`. The rule is:

- `NULL -> code` is allowed for the controlled initial assignment;
- `code -> same code` is allowed;
- `code -> another code` and `code -> NULL` raise SQLSTATE `P0001` with `DOCS_REFERENCE_CODE_IMMUTABLE`.

Normal docs created through `approve_docs_requests` or other current user workflows omit the column and therefore retain `NULL`. They are collections with user-facing identity, not fixed system roles. Infrastructure and presentation code must not invent a reference code for them.

The column is not consumed by TypeScript in this phase. `src/app/types/database.types.ts` remains untouched until an operator has applied the cloud migration and deliberately regenerates types in a later handoff.

Adding a nullable column does not rewrite existing rows. The exact 47-row update is bounded, but adding constraints and replacing trigger functions still take PostgreSQL catalog/table locks. Cloud execution should therefore use a quiet maintenance window after the read-only catalog preflight. Each migration is deliberately small and transactional so a lock timeout or validation failure leaves the prior production definition active.

## Backfill and versioned seed

The schema migration contains an exact `(legacy_id, expected_name, reference_code)` catalog for all 47 rows. It follows this order in one transaction:

1. Add the nullable column.
2. If `public.docs` is empty, skip remote-row validation; this is the fresh-reset state before `seed.sql` runs.
3. If `public.docs` is non-empty, require all 47 production IDs to have their exact recorded names. Abort with `DOCS_REFERENCE_BACKFILL_MISMATCH` before assigning any code if a row is missing or mismatched.
4. Update only matching production rows and leave their IDs, names, timestamps, visibility, and all foreign keys unchanged.
5. Assert that a non-empty database now has all 47 codes.
6. Add the format and unique constraints and the immutability trigger.

`supabase/seed.sql` remains the active versioned local seed. After its existing docs insert, it applies the same exact catalog to the seeded rows and asserts that exactly 47 references were assigned. The update is safe with the immutability trigger because fresh rows move from `NULL` to a code and repeated assignment uses the identical value. The checked-in CSV is evidence, not a second bootstrap mechanism, and is not turned into an independently executable seed.

This preserves current production IDs during upgrade while making them irrelevant at runtime. The final integration test deletes and reinserts the reference rows at deliberately different IDs inside a rolled-back test transaction and proves that the same trigger effects occur.

## Required-reference resolver and public error

The second forward migration is `supabase/migrations/20260826100000_add_required_docs_reference_resolver.sql`. It creates one database contract:

```sql
private.require_docs_reference_id(
    p_reference_code text,
    p_context text
) returns bigint
```

The function selects the one `public.docs.id` for `p_reference_code`. The unique constraint makes multiple matches impossible. If no match exists, the function:

1. emits a PostgreSQL `LOG` record containing the stable token, missing code, trusted caller context, `session_user`, and `current_user`; then
2. raises SQLSTATE `P0001` with message `DOCS_REQUIRED_REFERENCE_MISSING` and no client-facing detail or hint.

`p_context` is a constant supplied by a trigger such as `public.fn_process_word_docs_update:INSERT`; it is diagnostic data, not a user-supplied authorization input. The resolver does not write a diagnostic table because such a write would roll back with the failed business transaction. PostgreSQL server logging preserves the operator signal while the exception exposes only the stable public token.

The resolver is `SECURITY DEFINER`, has `SET search_path = ''`, schema-qualifies every relation and non-implicit function, and is not executable by `PUBLIC`, `anon`, `authenticated`, or `service_role`. Only owner-controlled trigger functions call it. Valid resolution returns a surrogate ID; consumers never cache or expose that ID as a semantic constant.

## Trigger replacements

The three trigger functions retain their names and trigger bindings so existing table behavior and dependent migrations remain intact. Each replacement uses `CREATE OR REPLACE FUNCTION` in a new transaction, `SET search_path = ''`, schema qualification, and no direct execution grants to application roles.

### Long-word logs

`supabase/migrations/20260826110000_convert_long_word_docs_trigger.sql` replaces `public.words_docs_logs_trg()`.

The eligibility and transition rules remain byte-for-byte equivalent in meaning:

- insert/delete affects long docs only when `k_canuse = true` and generated `length >= 9`;
- update emits nothing when old and new eligibility agree;
- a transition into eligibility emits `add`, and a transition out emits `delete`;
- update logs use `NEW.word` and `NEW.added_by`, matching the legacy function;
- the function inserts one log in each of `ko.word-chain.long` and `ko.reverse-word-chain.long` and does not directly update their `last_update` values.

Both references are resolved only inside a branch that needs them and before either log is inserted. A missing required reference therefore raises the stable resolver error and rolls back the initiating word statement.

### Mission child updates and logs

`supabase/migrations/20260826120000_convert_mission_word_docs_trigger.sql` replaces `public.fn_process_word_docs_update()`.

The function owns two parallel constant arrays:

```text
characters: 가, 나, 다, 라, 마, 바, 사, 아, 자, 차, 카, 타, 파, 하
keys:       ga, na, da, ra, ma, ba, sa, a,  ja, cha, ka, ta, pa, ha
```

For each character contained at least once in the inserted or deleted word, it constructs and resolves:

- `ko.word-chain.mission.<key>`;
- `ko.reverse-word-chain.mission.<key>`;
- and, only when generated word length is exactly three, `ko.kkungkkungtta.mission.<key>`.

The function first resolves the complete ordered target list, then updates every target child's `last_update`, then inserts logs in the same character/category order as the legacy nested loop. It continues to ignore `k_canuse`, run only on insert/delete, use `NEW` values for insert and `OLD` values for delete, and create one log per contained character/category rather than per occurrence.

Resolving the whole list before writes is an internal safety improvement with no committed behavior change. Even if a later trigger fails, PostgreSQL still rolls back all child timestamps and logs with the word statement.

### Mission-parent propagation

`supabase/migrations/20260826130000_convert_mission_parent_trigger.sql` replaces `public.sync_parent_last_update()`.

When `last_update` actually changes, the function compares `NEW.reference_code` against the exact 14 child-code suffixes for each family. A word-chain child resolves and updates `ko.word-chain.mission`; a reverse child resolves and updates `ko.reverse-word-chain.mission`; a Kkungkkungtta child resolves and updates `ko.kkungkkungtta.mission`. Parents and ordinary docs do not match a child catalog and cause no propagation.

If a required parent is missing, the child update raises `DOCS_REQUIRED_REFERENCE_MISSING`. When that child update originated from a word trigger, the original word change, all child timestamps, all parent timestamps, and all docs logs roll back together.

## Transaction, trigger, and security behavior

All five schema/function migrations use explicit `BEGIN` and `COMMIT`. Each trigger conversion begins with resolver preflight calls for every reference that the replacement needs. If the catalog is incomplete, the migration aborts and leaves the previous function definition active.

The trigger functions remain `AFTER` row triggers and `SECURITY DEFINER` because they update docs and logs as a side effect of word changes that may be initiated through RLS-constrained paths. Their security posture changes as follows:

- `SET search_path = ''` on the resolver, immutability trigger, and all three converted trigger functions;
- explicit `public`, `private`, and `pg_catalog` qualification;
- `REVOKE ALL` on helper and trigger functions from `PUBLIC`, `anon`, `authenticated`, and `service_role`;
- no new table grants and no weakening of existing RLS policies;
- the `reference_code` column remains readable with the docs row but is not exposed through a new public write API.

A user does not require `EXECUTE` on a trigger function for a table trigger to fire. Revoking direct execution therefore reduces attack surface without preventing authorized word DML.

The resolver failure is intentionally fatal. Silently skipping a log would commit a word state that disagrees with its system docs. PostgreSQL statement/RPC transaction semantics are the consistency boundary: either the word mutation and every derived docs effect commit, or none do.

## Database test strategy

All pgTAP tests use the disposable local Supabase database, wrap fixture changes in transactions where possible, and never use a linked or cloud target.

### Legacy characterization

`supabase/tests/database/docs-reference-trigger-characterization.integration.sql` is added before the semantic migrations. It fixes these existing behaviors:

- production IDs and names for all 47 roles;
- long-word qualifying insert and eligible delete behavior for `201` and `202`;
- both `false -> true` and `true -> false` eligibility transitions, both unchanged eligibility states producing no log, and update logs taking `word` and `add_by` from `NEW`;
- mission insert/delete behavior for a three-character word and a non-three-character word;
- one log per contained mission character, not per occurrence;
- child `last_update` changes and propagation to parents `208`, `223`, and `238`;
- no Kkungkkungtta log for a non-three-character word;
- complete rollback when a required legacy numeric row is absent.

The same characterization file must remain green after each trigger conversion, proving behavior parity on the production seed IDs.

### Schema and resolver contract

`supabase/tests/database/docs-reference-schema.integration.sql` proves:

- 47 exact codes and the expected production-ID backfill on the local seed;
- ordinary docs accept multiple `NULL` codes;
- duplicate and malformed non-null codes are rejected;
- initial `NULL -> code` assignment works, while reassignment and clearing fail with `DOCS_REFERENCE_CODE_IMMUTABLE`;
- the resolver returns the seeded ID, has an empty search path, and has no direct application-role execute grant;
- a missing code raises `P0001 / DOCS_REQUIRED_REFERENCE_MISSING` without exposing diagnostic detail;
- each converted trigger function has an empty search path, has no application-role execute grant, contains the semantic code constants, and no longer contains the legacy numeric-ID arithmetic.

### Varying primary keys and missing references

`supabase/tests/database/docs-semantic-reference.integration.sql` backs up the 47 rows inside its transaction, reinserts them with IDs outside `201..252`, and proves long logs, mission logs, and parent timestamps target the new IDs by `reference_code`. Its successful varying-PK long fixture and missing-reference long fixture use visibly different reserved words. The test clears any history for every reserved word before recording effects, so a missing-reference assertion always compares against an explicit zero-log baseline rather than logs created by the successful fixture.

It then removes, one at a time, a long reference, a mission child, and a mission parent. Each affected word mutation must raise `DOCS_REQUIRED_REFERENCE_MISSING`, leave the word absent or unchanged, create no partial logs, and restore all observed timestamps through rollback. It also proves that an unrelated short word that contains no mission character does not resolve unused references.

## Local bootstrap and ports

Task 2 changes only repository-local Supabase port configuration:

| Service | Old | New |
| --- | ---: | ---: |
| DB shadow | 54320 | 55320 |
| API | 54321 | 55321 |
| DB | 54322 | 55322 |
| Studio | 54323 | 55323 |
| Inbucket UI | 54324 | 55324 |
| Commented SMTP | 54325 | 55325 |
| Commented POP3 | 54326 | 55326 |
| Analytics | 54327 | 55327 |
| Pooler | 54329 | 55329 |

`55320..55329` was verified free when this design was prepared. `npx supabase start` and `npx supabase status` must succeed after the remap before any pgTAP result is accepted.

Task 9 adds a repository script that performs this exact local lifecycle: start, status, `db reset --local`, all local DB tests, and stop in a `finally` path. Every destructive database command includes `--local`; the script contains no `link`, `--linked`, `db push`, remote connection string, or migration-history mutation. Existing recorded migrations are neither renamed nor rewritten. A successful reset proves the baseline, forward migrations, and versioned seed form one reproducible fresh-bootstrap chain.

## Post-Phase-0B `WordsDocsHome` slice

After all database conversions and varying-PK tests are green, `src/modules/docs` gains two small contracts rather than a table-wide repository.

### Letter-docs duplicate query

```ts
export interface LetterDocsDuplicateQueryGateway {
    existsByName(docsName: string): Promise<Result<boolean>>;
}

export class CheckLetterDocsDuplicateService {
    constructor(private readonly gateway: LetterDocsDuplicateQueryGateway) {}
    check(docsName: string): Promise<Result<boolean>>;
}
```

`SupabaseLetterDocsDuplicateQueryGateway` requests only whether a `public.docs` row exists with `typez = 'letter'` and the exact submitted name. It does not load all docs rows. `useLetterDocsDuplicate(docsName)` is a disabled-by-default React Query whose `refetch()` is called at submit time, using `docsQueryKeys.letterDuplicate(docsName)`.

### Docs creation-request command

```ts
export type DocsCreationRequestCommand = {
    docsName: string;
    requesterId: string;
};

export interface DocsCreationRequestGateway {
    request(command: DocsCreationRequestCommand): Promise<Result<void>>;
}

export class RequestDocsCreationService {
    constructor(private readonly gateway: DocsCreationRequestGateway) {}
    request(command: DocsCreationRequestCommand): Promise<Result<void>>;
}
```

The Application service preserves the current one-JavaScript-code-unit name rule and requires a non-empty requester ID. It does not restrict input to Hangul or trim it because that would change current behavior. `SupabaseDocsCreationRequestGateway` performs the existing single-table `docs_wait` insert through the browser client and returns only `Result<void>`. This is an RLS-protected single-table command, so a new RPC and Route Handler are unnecessary for this slice.

`useDocsCreationRequest()` owns the React Query mutation and invalidates `docsQueryKeys.pendingRequests` after success. The component still refreshes pending requests immediately before submission to preserve the current duplicate check.

The mutation resolves with the service's `Result<void>` rather than rejecting for an expected Application error. Its public `error` is therefore hook-local `useState<ApplicationError | null>` state, not React Query's `mutation.error`. Starting every submission clears that state before calling the service; a fulfilled `Result.err` or a caught unexpected throw sets it; a fulfilled `Result.ok` leaves it null and invalidates the pending-request query. `clearError()` sets only that local state to null, and the next submission clears it again even if the caller never invoked `clearError()`.

Its public return contract is:

```ts
{
    request(command: DocsCreationRequestCommand): Promise<Result<void>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
}
```

### Preserved presentation behavior

The submit sequence remains:

1. unauthenticated open attempts show `LoginRequiredModal`;
2. submit refetches the exact letter duplicate and pending-request queries;
3. existing docs show `이미 존재하는 문서명입니다.`;
4. pending duplicates show `이미 추가 요청된 문서명입니다.`;
5. pending query failure shows `문서 요청 목록을 불러오는 중 오류가 발생했습니다.`;
6. letter query or insert failure shows `문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.` without raw PostgREST details;
7. an error remains inline for the current three seconds;
8. success closes the request modal and opens the existing `CompleteModal`.

`WordsDocsHome.tsx` retains its search, grouping, sorting, motion, and visual markup. It imports only the docs feature hooks, not `SCM`, Supabase response types, table names, or query builders.

### Legacy removal criteria

The slice is not complete until all of the following are true:

- `git grep` finds no production call to `SCM.get().letterDocs()` or `SCM.add().waitDocs()`;
- `WordsDocsHome.tsx` no longer imports `@/src/app/lib/supabaseClient`;
- `letterDocs` is removed from `IGetManager` and `SupabaseGetManager`;
- `waitDocs` is removed from `IAddManager` and `SupabaseAddManager`;
- tests no longer mock those legacy SCM methods;
- adjacent SCM methods that still have consumers are unchanged.

## Rollout and rollback

### Local and code rollout

Tasks are applied in strict order: characterize; add schema/backfill/seed; add resolver; replace long trigger; replace mission trigger; replace parent trigger; prove varying IDs and missing references; automate fresh bootstrap; then migrate `WordsDocsHome`.

Each migration is independently reviewable and transactional. Local completion means the migration chain and tests pass; it does not mean any migration exists in cloud Supabase.

### Cloud rollout

Cloud rollout remains user/operator controlled. The operator should:

1. back up or otherwise ensure recoverability;
2. use read-only queries to verify the 47 legacy IDs and names;
3. apply the five new migration files in timestamp order;
4. verify 47 unique codes, function search paths, grants, and trigger bindings;
5. perform a controlled word insert/delete smoke test;
6. monitor server logs for `DOCS_REQUIRED_REFERENCE_MISSING`.

Codex must not push these migrations, repair remote history, or regenerate remote types without a separate explicit request.

### Rollback

Applied migration files are never edited, renamed, or deleted. If rollout stops before a later migration, the earlier nullable column and resolver are backward compatible and may remain in place. If a converted trigger must be restored, the operator uses a new forward repair migration containing the previously characterized function body; the column and assigned codes can remain because they do not change ordinary docs behavior.

If a reference is missing, the preferred recovery is to restore the correct reference row/code and retry the failed transaction, not to disable the resolver or skip derived logs. Clearing or reassigning an assigned code requires an explicit forward repair that deliberately removes/reinstates the immutability trigger; it is not an ordinary rollback operation.

## Verification and acceptance

Implementation completion requires:

```bash
npx supabase start
npx supabase status
npx supabase db reset --local
npm run test:docs-reference-db
npx jest src/__tests__/words-docs/WordsDocsHome.test.tsx src/__tests__/modules/docs --runInBand
npm run lint
npx tsc --noEmit
npm test -- --runInBand
git diff --check
```

`npm run build` is an optional final confidence check because the slice does not change a Next.js build boundary; if it is not run, the handoff states that explicitly. The local Supabase stack is stopped after database verification even when a test fails.

The design is accepted when numeric primary keys are absent from the three trigger bodies, all committed behavior is identical on the production seed and on varying IDs, missing references fail atomically with the stable public token and server diagnostics, fresh local bootstrap is reproducible without cloud access, and `WordsDocsHome` no longer depends on its two replaced SCM methods.
