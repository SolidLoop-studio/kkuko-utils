# Resumable Word Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin/del-words` browser-orchestrated SCM mutations with a resumable `word-moderation` use case backed by idempotent PostgreSQL transaction batches.

**Architecture:** A deletion-specific Domain/Application slice normalizes file entries, hashes deterministic batches, and persists resumable browser jobs. A browser Supabase adapter calls deletion-specific operation RPCs; each batch atomically authorizes the actor, locks and classifies words, records logs and contributions, deletes words, updates docs, and stores an authoritative result. The page only composes a tested panel and feature hook.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, React Query, Supabase/PostgreSQL PL/pgSQL, IndexedDB via `idb`, Jest/Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-21-resumable-word-deletion-design.md`

## Global Constraints

- Work only in `C:\dev\kkuko-utils\.worktrees\resumable-word-deletion` on `feat/resumable-word-deletion`.
- Follow red-green-refactor: every production behavior starts with a test that is observed failing for the expected reason.
- Do not call or modify a linked/remote Supabase project; use `--local` only and never `--linked`.
- Stop the local Supabase stack at the end even if a DB test fails.
- Do not manually edit `src/app/types/database.types.ts`.
- Do not add new methods to SCM or expose Supabase types above Infrastructure.
- Keep the existing numeric reference-doc triggers unchanged.
- Credit one point per actually deleted word to the oldest whole-word deletion requester; fall back to the authenticated processing administrator.
- Commit each task only after its focused tests pass.

---

### Task 1: Deletion Domain and Deterministic Payload

**Files:**
- Create: `src/modules/word-moderation/domain/word-deletion.ts`
- Create: `src/modules/word-moderation/application/word-deletion-payload.ts`
- Test: `src/__tests__/modules/word-moderation/domain/word-deletion.test.ts`
- Test: `src/__tests__/modules/word-moderation/application/word-deletion-payload.test.ts`

**Interfaces:**
- Produces: `RawWordDeletionEntry`, `NormalizedWordDeletionEntry`, `MAX_WORD_DELETION_BATCH_SIZE`, `normalizeWordDeletionEntries`, `splitWordDeletionBatches`.
- Produces: `serializeWordDeletionEntries`, `buildWordDeletionPayload` returning `{ inputHash, batches }`.
- Consumes: shared `Result<T>`, `ok`, and `err`.

- [ ] **Step 1: Write failing Domain tests**

Create tests that specify the wished-for API before the module exists:

```ts
import {
    MAX_WORD_DELETION_BATCH_SIZE,
    normalizeWordDeletionEntries,
    splitWordDeletionBatches,
} from '@/src/modules/word-moderation/domain/word-deletion';

describe('word deletion domain', () => {
    it('removes CR and empty lines, deduplicates, and sorts deterministically', () => {
        const result = normalizeWordDeletionEntries([
            { word: '하늘\r' },
            { word: '' },
            { word: '가방' },
            { word: '하늘' },
        ]);

        expect(result).toEqual({
            ok: true,
            value: [{ word: '가방' }, { word: '하늘' }],
        });
    });

    it('rejects leading or trailing whitespace instead of silently changing a word', () => {
        const result = normalizeWordDeletionEntries([{ word: ' 가방' }]);
        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'word' }),
        });
    });

    it('rejects input with no words', () => {
        expect(normalizeWordDeletionEntries([{ word: '' }])).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'entries' }),
        });
    });

    it('splits batches and enforces the DB maximum', () => {
        const entries = Array.from({ length: 51 }, (_, index) => ({ word: `단어${index}` }));
        expect(splitWordDeletionBatches(entries, 50)).toEqual({
            ok: true,
            value: [entries.slice(0, 50), entries.slice(50)],
        });
        expect(splitWordDeletionBatches(entries, MAX_WORD_DELETION_BATCH_SIZE + 1)).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'batchSize' }),
        });
    });
});
```

- [ ] **Step 2: Run the Domain test and verify RED**

Run:

```bash
npx jest src/__tests__/modules/word-moderation/domain/word-deletion.test.ts --runInBand
```

Expected: FAIL because `word-deletion.ts` does not exist.

- [ ] **Step 3: Implement the minimum Domain API**

Implement Unicode-scalar sorting using the existing approval Domain comparator pattern. Use these public shapes:

```ts
export const MAX_WORD_DELETION_BATCH_SIZE = 50;

export type RawWordDeletionEntry = { word: string };
export type NormalizedWordDeletionEntry = { word: string };

export function normalizeWordDeletionEntries(
    entries: RawWordDeletionEntry[],
): Result<NormalizedWordDeletionEntry[]>;

export function splitWordDeletionBatches(
    entries: NormalizedWordDeletionEntry[],
    batchSize: number,
): Result<NormalizedWordDeletionEntry[][]>;
```

Normalization must remove one terminal `\r`, skip resulting empty strings, reject any remaining leading/trailing whitespace, deduplicate by exact word, and sort with the same locale-independent comparator as `word-approval.ts`.

- [ ] **Step 4: Run the Domain test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing deterministic payload tests**

```ts
import {
    buildWordDeletionPayload,
    serializeWordDeletionEntries,
} from '@/src/modules/word-moderation/application/word-deletion-payload';

describe('word deletion payload', () => {
    it('serializes only the stable word contract', () => {
        expect(serializeWordDeletionEntries([{ word: '가방' }, { word: '하늘' }]))
            .toBe('[{"word":"가방"},{"word":"하늘"}]');
    });

    it('builds stable hashes and indexed batches', async () => {
        const payload = await buildWordDeletionPayload(
            [{ word: '가방' }, { word: '하늘' }],
            1,
        );
        expect(payload.inputHash).toMatch(/^[0-9a-f]{64}$/);
        expect(payload.batches.map(({ batchIndex, entries }) => ({ batchIndex, entries })))
            .toEqual([
                { batchIndex: 0, entries: [{ word: '가방' }] },
                { batchIndex: 1, entries: [{ word: '하늘' }] },
            ]);
        expect(payload.batches.every((batch) => /^[0-9a-f]{64}$/.test(batch.payloadHash)))
            .toBe(true);
    });
});
```

- [ ] **Step 6: Verify payload RED, implement, and verify GREEN**

Run the payload test, observe the missing-module failure, then implement `sha256`, stable serialization, domain batch splitting, and indexed batch hashes. Prefix the input hash material with `word-deletion:v1:` so it cannot collide semantically with add-approval input hashes.

Run:

```bash
npx jest src/__tests__/modules/word-moderation/domain/word-deletion.test.ts src/__tests__/modules/word-moderation/application/word-deletion-payload.test.ts --runInBand
```

Expected: 2 suites PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/modules/word-moderation/domain/word-deletion.ts src/modules/word-moderation/application/word-deletion-payload.ts src/__tests__/modules/word-moderation/domain/word-deletion.test.ts src/__tests__/modules/word-moderation/application/word-deletion-payload.test.ts
git commit -m "feat: add word deletion domain"
```

---

### Task 2: Resumable Deletion Application Service

**Files:**
- Create: `src/modules/word-moderation/application/word-deletion-types.ts`
- Create: `src/modules/word-moderation/application/word-deletion-ports.ts`
- Create: `src/modules/word-moderation/application/run-word-deletion.ts`
- Test: `src/__tests__/modules/word-moderation/application/run-word-deletion.test.ts`

**Interfaces:**
- Consumes: `normalizeWordDeletionEntries`, `buildWordDeletionPayload` from Task 1.
- Produces: `WordDeletionOperationGateway`, `WordDeletionJobStore`, `RunWordDeletionService`.
- Produces result counters: `deletedWordCount`, `protectedWordCount`, `missingWordCount`, `processedRequestCount`, `affectedDocsIds`.

- [ ] **Step 1: Write the service test fake ports and failing start test**

Define small in-memory fakes implementing this exact contract:

```ts
export interface WordDeletionOperationGateway {
    startOperation(input: StartWordDeletionOperationInput): Promise<Result<WordDeletionOperation>>;
    getOperation(operationId: string): Promise<Result<WordDeletionOperation>>;
    deleteBatch(command: DeleteWordBatchCommand): Promise<Result<DeleteWordBatchResult>>;
    cancelOperation(operationId: string): Promise<Result<void>>;
}

export interface WordDeletionJobStore {
    save(job: StoredWordDeletionJob): Promise<void>;
    get(operationId: string): Promise<StoredWordDeletionJob | null>;
    listPending(): Promise<StoredWordDeletionJob[]>;
    remove(operationId: string): Promise<void>;
}
```

The first test must start two batches, observe progress, aggregate counters, deduplicate docs IDs, and remove the stored job only after the final authoritative `getOperation` reports `completed`.

- [ ] **Step 2: Run and verify RED**

```bash
npx jest src/__tests__/modules/word-moderation/application/run-word-deletion.test.ts --runInBand
```

Expected: FAIL because the service/types/ports do not exist.

- [ ] **Step 3: Add types, ports, and the minimal start path**

Use these central DTOs:

```ts
export type WordDeletionOperationStatus = 'running' | 'completed' | 'cancelled';

export interface DeleteWordBatchResult {
    deletedWordCount: number;
    protectedWordCount: number;
    missingWordCount: number;
    processedRequestCount: number;
    affectedDocsIds: number[];
}

export interface StoredWordDeletionJob {
    operationId: string;
    inputHash: string;
    entries: NormalizedWordDeletionEntry[];
    batchSize: number;
    createdAt: string;
}

export interface WordDeletionRunResult extends DeleteWordBatchResult {
    operationId: string;
}
```

Mirror the proven validation and authoritative aggregation strategy in `RunWordApprovalService`, but keep all deletion names and Korean user messages deletion-specific.

- [ ] **Step 4: Verify GREEN for start, then add RED tests one behavior at a time**

Add and observe failure before implementing each behavior:

- invalid input returns `validation` without saving or calling the gateway;
- resume rejects a local input hash mismatch;
- resume restarts a locally saved operation when DB returns `not-found`;
- completed batches with matching hashes are skipped;
- duplicate/out-of-range/mismatched completed batch metadata returns `conflict`;
- cancelled operation returns `conflict`;
- batch failure preserves the local job;
- successful completion removes the local job;
- cancel treats DB `not-found` as an idempotent success and removes the local job;
- final operation must be `completed` with all batch metadata present.

After each RED, add only enough service code for GREEN.

- [ ] **Step 5: Run the focused service suite**

```bash
npx jest src/__tests__/modules/word-moderation/application/run-word-deletion.test.ts --runInBand
```

Expected: PASS with no console warnings.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/modules/word-moderation/application/word-deletion-types.ts src/modules/word-moderation/application/word-deletion-ports.ts src/modules/word-moderation/application/run-word-deletion.ts src/__tests__/modules/word-moderation/application/run-word-deletion.test.ts
git commit -m "feat: orchestrate resumable word deletion"
```

---

### Task 3: Transactional Word Deletion RPC and Local DB Tests

**Files:**
- Create: `supabase/migrations/20260821120000_add_word_deletion_batch.sql`
- Create: `supabase/tests/database/word-deletion-batch.integration.sql`
- Create: `supabase/tests/database/word-deletion-concurrency.integration.sql`
- Modify: `package.json`

**Interfaces:**
- Produces public RPCs `start_word_deletion_operation`, `get_word_deletion_operation`, `apply_word_deletion_batch`, `cancel_word_deletion_operation`.
- Produces stable public DB error codes from the spec.
- Consumes existing `public.increment_contribution`, `public.update_last_updates`, word delete triggers, and current schema constraints.

- [ ] **Step 1: Start the disposable local stack and establish migration baseline**

```bash
supabase start
supabase db reset --local
```

Do not use `--linked`. If reset fails, capture the exact migration and SQL error, use `superpowers:systematic-debugging`, and fix only a repository-local fresh-bootstrap defect that blocks this migration/test. Do not substitute a remote database.

- [ ] **Step 2: Write the failing pgTAP behavior test before the migration**

Create fixtures with reserved UUIDs/words and begin with assertions that call the missing functions:

```sql
begin;
select plan(1);

select lives_ok(
    $$select public.start_word_deletion_operation(
        '20000000-0000-4000-8000-000000000001', repeat('a', 64), 1, 1
    )$$,
    'deletion operation RPC must exist'
);

select * from finish();
rollback;
```

Run directly with `supabase test db --local supabase/tests/database/word-deletion-batch.integration.sql` and verify RED because `lives_ok` reports that the RPC is missing. Replace the bootstrap assertion with the complete behavior suite as the migration is implemented.

- [ ] **Step 3: Add operation tables and authorization functions**

The migration must create:

```sql
create table public.word_deletion_operations (
    operation_id uuid primary key,
    actor_id uuid not null references public.users(id),
    input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
    total_entries integer not null check (total_entries > 0),
    total_batches integer not null check (total_batches > 0),
    status text not null default 'running'
        check (status in ('running', 'completed', 'cancelled')),
    created_at timestamp with time zone not null default pg_catalog.now(),
    updated_at timestamp with time zone not null default pg_catalog.now()
);

create table public.word_deletion_batches (
    operation_id uuid not null
        references public.word_deletion_operations(operation_id) on delete cascade,
    batch_index integer not null check (batch_index >= 0),
    payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
    entry_count integer not null check (entry_count between 1 and 50),
    result jsonb not null,
    created_at timestamp with time zone not null default pg_catalog.now(),
    primary key (operation_id, batch_index)
);

create unique index word_deletion_operations_running_input_key
    on public.word_deletion_operations (actor_id, input_hash)
    where status = 'running';

alter table public.word_deletion_operations enable row level security;
alter table public.word_deletion_batches enable row level security;
```

Create a private assertion helper that obtains `auth.uid()`, loads `public.users.role`, accepts only `r4` or `admin`, and raises `WORD_DELETION_UNAUTHORIZED` or `WORD_DELETION_FORBIDDEN`. All public functions must be `SECURITY DEFINER` with a fixed search path and schema-qualified objects.

- [ ] **Step 4: Add start/get/cancel RPC tests and minimum implementations**

Test and implement these behaviors in RED-GREEN cycles:

- missing JWT actor rejected;
- `r1` rejected and `r4`/`admin` accepted;
- same actor/input returns the running operation;
- mismatched operation metadata conflicts;
- another actor cannot get/cancel an operation;
- cancelling `running` is idempotent and completed remains completed;
- `anon` lacks EXECUTE, `authenticated` has EXECUTE;
- function `proconfig` contains the fixed trusted search path.

- [ ] **Step 5: Add apply-batch validation tests and minimum validation**

Test null/malformed payload, unknown operation, wrong actor, wrong total batch count, out-of-order index, invalid/duplicate/whitespace words, batch sizes 0 and 51, invalid hashes, cancelled operation, same-index different-hash conflict, and same-hash replay.

The payload recordset is exactly:

```sql
from pg_catalog.jsonb_to_recordset(p_entries) as entry(word text)
```

- [ ] **Step 6: Add atomic business-effect tests and implementation**

Within one test transaction, create an admin, two requesters, letter/theme docs, a numeric-code protected theme, normal themes, deletable words, delete requests, and theme delete requests. Assert:

- real deletions create one `logs` row each with `processed_by = auth.uid()`;
- oldest whole-word delete requester becomes `make_by` and receives one contribution;
- actor receives contribution only when a whole-word requester is absent;
- protected words remain with no new moderation log or contribution;
- missing words increase only `missingWordCount`;
- letter/theme docs logs identify the selected contributor;
- affected docs timestamps update;
- delete requests and dependent relationships disappear;
- trigger-maintained word counts/statistics and special reference docs behavior still execute;
- returned and persisted result JSON exactly match.

Use deterministic `FOR UPDATE` ordering and base all logs/contributions on rows returned by the actual deletion path. Capture requester and docs metadata before the delete, but never credit rows not returned as actually deleted.

- [ ] **Step 7: Add forced rollback test**

Create a temporary trigger that raises during a reserved test word's log insert. Assert the public error is `WORD_DELETION_INTERNAL_ERROR` and the word, requests, contributions, docs timestamps, operation state, and batch metadata all remain unchanged.

- [ ] **Step 8: Add the concurrency test**

Use the existing approval concurrency harness pattern with `dblink` and reserved identifiers. Two committed sessions must apply overlapping deletion batches. Assert both operations finish, the word is deleted once, and moderation logs, docs logs, and contribution increments occur exactly once. Keep the controller in autocommit mode to avoid lock-retention deadlocks.

- [ ] **Step 9: Add the package script and run DB suites**

Add:

```json
"test:word-deletion-db": "supabase test db --local supabase/tests/database/word-deletion-batch.integration.sql supabase/tests/database/word-deletion-concurrency.integration.sql"
```

Run:

```bash
npm run test:word-approval-db
npm run test:word-deletion-db
```

Expected: existing approval tests and new deletion tests PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add package.json supabase/migrations/20260821120000_add_word_deletion_batch.sql supabase/tests/database/word-deletion-batch.integration.sql supabase/tests/database/word-deletion-concurrency.integration.sql
git commit -m "feat: add transactional word deletion RPC"
```

Leave the local stack running for later gateway/manual integration verification; it must be stopped in Task 7.

---

### Task 4: Browser Gateway, IndexedDB Store, and Composition Root

**Files:**
- Create: `src/modules/word-moderation/infrastructure/browser/supabase-word-deletion-gateway.ts`
- Create: `src/modules/word-moderation/infrastructure/browser/word-deletion-job-db.ts`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-deletion-gateway.test.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/word-deletion-job-db.test.ts`
- Modify: `src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts`

**Interfaces:**
- Consumes Task 2 ports/types and Task 3 RPC names.
- Produces `SupabaseWordDeletionGateway`, `IndexedDbWordDeletionJobStore`, and `BrowserWordModerationServices.wordDeletionService`.

- [ ] **Step 1: Write failing gateway tests**

Inject a narrow RPC client fake and assert exact calls:

```ts
expect(rpc).toHaveBeenCalledWith('apply_word_deletion_batch', {
    p_operation_id: operationId,
    p_batch_index: 0,
    p_total_batches: 1,
    p_payload_hash: payloadHash,
    p_entries: [{ word: '가방' }],
});
```

Add one test per start/get/apply/cancel call, runtime response parsing, malformed result rejection, and mapping of all six public deletion error codes.

- [ ] **Step 2: Verify gateway RED, implement, and verify GREEN**

Use the existing approval gateway's `unknown` narrowing pattern. Do not import the generated DB Row above this adapter and do not return PostgREST responses.

```bash
npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-deletion-gateway.test.ts --runInBand
```

- [ ] **Step 3: Write failing IndexedDB tests**

Test save/get/list/remove against a deletion-only database and store:

```ts
const DATABASE_NAME = 'KkukoUtilsWordDeletionOperations';
const STORE_NAME = 'word-deletion-jobs';
```

Use a separate database name so adding this store does not break existing clients that already opened `KkukoUtilsOperations` at version 1.

- [ ] **Step 4: Verify store RED, implement, and verify GREEN**

Implement `WordDeletionJobStore`, sort pending jobs by `createdAt`, and keep database opening lazy.

```bash
npx jest src/__tests__/modules/word-moderation/infrastructure/browser/word-deletion-job-db.test.ts --runInBand
```

- [ ] **Step 5: Add composition-root RED test and implementation**

Assert `createBrowserWordModerationServices()` returns a stable singleton with both `wordApprovalService` and `wordDeletionService`. Wire the deletion gateway/store into `RunWordDeletionService` without altering approval behavior.

- [ ] **Step 6: Run all Infrastructure suites**

```bash
npx jest src/__tests__/modules/word-moderation/infrastructure/browser --runInBand
```

Expected: all approval and deletion Infrastructure suites PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/modules/word-moderation/infrastructure/browser src/__tests__/modules/word-moderation/infrastructure/browser
git commit -m "feat: connect word deletion infrastructure"
```

---

### Task 5: React Query Word Deletion Hook

**Files:**
- Create: `src/modules/word-moderation/presentation/use-word-deletion.ts`
- Test: `src/__tests__/modules/word-moderation/presentation/use-word-deletion.test.tsx`
- Modify: `src/modules/word-moderation/index.ts`

**Interfaces:**
- Consumes `RunWordDeletionService` through an injectable `WordDeletionService` interface.
- Produces `start`, `resume`, `cancel`, `progress`, `error`, `clearError`, `result`, `pendingJobs`, `isPending`.

- [ ] **Step 1: Write failing hook tests**

Render with a `QueryClientProvider` and inject a small service fake. Specify:

```ts
const { result } = renderHook(() => useWordDeletion(service), { wrapper });
await act(async () => result.current.start([{ word: '가방' }]));
expect(service.start).toHaveBeenCalledWith(
    [{ word: '가방' }],
    expect.any(Function),
);
```

Add tests for progress forwarding, result storage, Application error exposure, unexpected exception conversion to `infrastructure`, pending query loading, resume, cancel, pending-job invalidation, and `clearError`.

- [ ] **Step 2: Run and verify RED**

```bash
npx jest src/__tests__/modules/word-moderation/presentation/use-word-deletion.test.tsx --runInBand
```

- [ ] **Step 3: Implement the hook minimally**

Follow `use-word-approval.ts` but use deletion-specific query keys and messages. Resolve the default service only when `indexedDB` exists. Do not store server state in Redux.

- [ ] **Step 4: Export only public feature APIs**

Update `src/modules/word-moderation/index.ts` to export the deletion raw input/result/progress types and hook. Do not export adapters, RPC names, generated types, or database rows.

- [ ] **Step 5: Run presentation and public-boundary tests**

```bash
npx jest src/__tests__/modules/word-moderation/presentation/use-word-deletion.test.tsx src/__tests__/modules/word-moderation/presentation/use-word-approval.test.tsx --runInBand
```

- [ ] **Step 6: Commit Task 5**

```bash
git add src/modules/word-moderation/presentation/use-word-deletion.ts src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/presentation/use-word-deletion.test.tsx
git commit -m "feat: expose word deletion hook"
```

---

### Task 6: Replace DelWordsHome SCM Orchestration

**Files:**
- Create: `src/app/admin/del-words/WordDeletionPanel.tsx`
- Modify: `src/app/admin/del-words/DelWordsHome.tsx`
- Create: `src/__tests__/admin/del-words/WordDeletionPanel.test.tsx`
- Create: `src/__tests__/admin/del-words/DelWordsHome.test.tsx`
- Modify conditionally: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify conditionally: `src/app/lib/supabase/ISupabaseClientManager.ts`

**Interfaces:**
- Consumes Task 5 public `useWordDeletion` API.
- Produces a page with no SCM/Supabase data-access knowledge.

- [ ] **Step 1: Add characterization tests around user-visible behavior**

Before modifying the page, test the existing heading, file-required error, accepted file selection, preview truncation, process button disabled state, progress Modal, completion message, and error Modal contract. Inject the deletion hook into `WordDeletionPanel` through a prop or a small view-model interface so tests never mock Supabase.

- [ ] **Step 2: Run characterization tests against the existing page**

The page-level rendering tests should PASS for behavior already present. The panel/hook-boundary test should FAIL because `WordDeletionPanel` does not yet exist; this is the RED for the split and new execution path.

- [ ] **Step 3: Implement `WordDeletionPanel` using the feature hook**

Convert file content with:

```ts
const entries = fileContent.split('\n').map((word) => ({ word }));
await deletion.start(entries);
```

Let Domain validation handle CR, empties, duplicates, and whitespace. Display progress from completed entries/total entries, and display deleted/protected/missing counts from the final result. Surface only Application messages through the project's Modal component; do not recreate `PostgrestError` UI.

- [ ] **Step 4: Reduce `DelWordsHome` to composition/layout**

Keep the existing title, description, admin link, and page styling. Replace all local DB orchestration and the `SCM`, `PostgrestError`, `chunk`, Redux user-ID imports with `WordDeletionPanel`.

- [ ] **Step 5: Add resume/cancel and duplicate-submit tests**

Assert pending jobs render with operation ID/created time, resume and cancel call the hook once, processing disables new submission and Modal close, and completion permits close.

- [ ] **Step 6: Add the architecture boundary test**

Read both source files and assert they contain none of:

```ts
['SCM', '@supabase/supabase-js', '.rpc(', '.from(']
```

- [ ] **Step 7: Remove only truly unused SCM methods**

Run:

```bash
rg -n "allDocs\(|allWaitWords\(|allWordWaitTheme\(|waitWordsThemes\(|wordsByWords\(|wordsThemes\(|wordByIds\(|wordLog\(|docsLog\(|docsLastUpdate\(|userContribution\(" src
```

Delete a manager/interface method only if no consumer remains outside the replaced page. Do not refactor other SCM consumers.

- [ ] **Step 8: Run focused UI and moderation suites**

```bash
npx jest src/__tests__/admin/del-words src/__tests__/modules/word-moderation --runInBand
```

Expected: all focused suites PASS without act or console warnings introduced by this feature.

- [ ] **Step 9: Commit Task 6**

```bash
git add src/app/admin/del-words src/__tests__/admin/del-words src/app/lib/supabase/SupabaseClientManager.ts src/app/lib/supabase/ISupabaseClientManager.ts
git commit -m "refactor: migrate bulk word deletion"
```

If neither manager file changed, omit it from `git add`.

---

### Task 7: Documentation, Local Verification, and Cloud Rollout Handoff

**Files:**
- Create: `docs/testing/word-deletion-rpc-integration.md`
- Create: `docs/deployment/word-deletion-rpc-cloud-rollout.md`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Documents only local DB execution during development.
- Produces a cloud Supabase rollout checklist but does not execute it.

- [ ] **Step 1: Write the integration-test document**

Document exact prerequisites, reserved fixture behavior, assertion coverage, and commands:

```bash
supabase start
supabase db reset --local
npm run test:word-approval-db
npm run test:word-deletion-db
supabase stop
```

State explicitly that `--linked`, production connection strings, and remote projects are forbidden test targets.

- [ ] **Step 2: Write the cloud Supabase rollout handoff**

Include these exact phases:

1. Confirm the intended project with `supabase projects list` and inspect the local link metadata without changing it.
2. Back up the cloud database using the team's normal Supabase backup process.
3. Compare remote migration history with local migration files using a read-only migration listing.
4. Review the SQL diff and confirm it creates only deletion operation tables/functions/grants/indexes.
5. Apply `20260821120000_add_word_deletion_batch.sql` through the team's approved cloud migration workflow; if using CLI, run `supabase db push` only after manually verifying the linked project ref.
6. Verify function signatures, `authenticated`/`anon` privileges, fixed search paths, and operation-table RLS.
7. Perform an authenticated admin smoke test with a disposable test word and confirm word/log/docs/contribution effects.
8. Monitor Postgres logs for `WORD_DELETION_INTERNAL_ERROR` and retain the operation ID for diagnosis.
9. If rollback is required, create a new forward migration that revokes/drops the four RPCs, then drops batches before operations; never edit or delete an already applied migration.

Do not include secrets, access tokens, passwords, or a hard-coded project ref.

- [ ] **Step 3: Update the roadmap**

Mark `admin/del-words` completed only after all checks below pass. Update the quantitative SCM import/call snapshot using fresh `rg` counts and set the next Phase 1 action to `admin/request-words` characterization/design. Record that cloud Supabase deployment is pending user execution.

- [ ] **Step 4: Run focused verification**

```bash
npx jest src/__tests__/admin/del-words src/__tests__/modules/word-moderation --runInBand
npm run test:word-approval-db
npm run test:word-deletion-db
```

- [ ] **Step 5: Run repository-required verification**

```bash
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
```

Because this changes DB schema/RPC but not Next.js build configuration, run `npm run build` only if lint/type-check reveals a bundling boundary concern or the page imports differ between client and server.

- [ ] **Step 6: Stop local Supabase in a finally-style cleanup**

```bash
supabase stop
```

Run this even when a DB test or later verification fails. Confirm no local Supabase containers for this project remain running.

- [ ] **Step 7: Inspect the final scope**

```bash
git status --short
git diff --stat HEAD~1
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" src/app/admin/del-words
git log --oneline --decorate -10
```

Expected: only feature, migration, tests, and requested docs changed; the boundary search has no matches.

- [ ] **Step 8: Commit Task 7**

```bash
git add docs/testing/word-deletion-rpc-integration.md docs/deployment/word-deletion-rpc-cloud-rollout.md docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "docs: document word deletion rollout"
```

---

## Final Review Gates

- Run `superpowers:requesting-code-review` after every task; resolve specification issues before moving on.
- Run `superpowers:verification-before-completion` after Task 7 and before claiming success.
- Do not push, link, migrate, or smoke-test the cloud Supabase project in this session.
- Report the exact local verification commands and results, remaining warnings, commit list, migration filename, and cloud rollout document to the user.
