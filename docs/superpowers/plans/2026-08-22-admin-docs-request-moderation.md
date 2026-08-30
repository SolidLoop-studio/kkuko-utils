# Admin Docs Request Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `admin/request-docs` approval and rejection mutations from sequential browser SCM calls to a dedicated `docs` DDD-lite slice backed by atomic PostgreSQL RPCs.

**Architecture:** `RequestDocsHome` calls a React Query hook exported by `src/modules/docs`; the hook delegates to an Application service through a small gateway port, and the browser Infrastructure adapter calls separate approval and rejection RPCs. Each RPC validates the authenticated admin, locks all selected `docs_wait` rows, and atomically creates/deletes data for at most 30 requests.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, React Query 5, Jest 30, Testing Library, Supabase/PostgreSQL PL/pgSQL, pgTAP

**Spec:** `docs/superpowers/specs/2026-08-22-admin-docs-request-moderation-design.md`

## Global Constraints

- Only `admin/request-docs` approval and rejection mutations move; `RequestDocsWrapper` and `SCM.get().addWaitDocs()` remain unchanged.
- A command contains 1 through 30 unique positive safe-integer request IDs.
- Approval and rejection are all-or-nothing; partial success is forbidden.
- Approval derives `name` and `maker` from locked `docs_wait` rows, never from client-supplied values.
- `typez` is always `letter`; `duem` comes from the administrator selection.
- Domain and Application must not import React, Next.js, Supabase, or generated database types.
- `RequestDocsHome` must not import `SCM`, Supabase SDK types, generated database types, or call `.rpc()`/`.from()`.
- Use the project Modal for mutation errors and expose only stable public messages.
- Do not manually edit `src/app/types/database.types.ts`.
- Do not run `supabase db push`, `supabase --linked`, or any command against a remote project.
- Start and stop local Supabase only for database tests; always run `supabase stop` after the database test attempt.
- Follow red-green-refactor for every production-code change.

---

### Task 1: Characterize the Existing Request Docs UI

**Files:**
- Create: `src/__tests__/admin/request-docs/RequestDocsHome.test.tsx`

**Interfaces:**
- Consumes: Existing `DocsWaitManager` props and legacy `SCM.add().docs` / `SCM.delete().waitDocsByIds` calls.
- Produces: A behavior safety net for command mapping, success cleanup, failure preservation, and rejection before the UI is rewired.

- [ ] **Step 1: Write the characterization tests around observable behavior**

Create a test fixture with request IDs `11` and `22`, and mock the legacy SCM module before importing the component:

```tsx
jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        add: () => ({ docs: jest.fn() }),
        delete: () => ({ waitDocsByIds: jest.fn() }),
    },
}));

const requests = [
    {
        id: 11,
        req_at: '2026-08-22T00:00:00.000Z',
        docs_name: '가',
        req_by: '신청자 A',
        initial_consonant: false,
        req_byId: '00000000-0000-0000-0000-000000000011',
    },
    {
        id: 22,
        req_at: '2026-08-22T00:01:00.000Z',
        docs_name: '나',
        req_by: '신청자 B',
        initial_consonant: false,
        req_byId: null,
    },
];
```

Cover these behaviors with Testing Library interactions:

```tsx
it('선택한 요청과 두음 설정으로 docs를 승인하고 성공 후 행을 제거한다', async () => {
    // Select request 11, enable its "두음 적용" checkbox, click "선택 승인".
    // Assert docs insert receives [{ name: '가', maker: uuid, duem: true, typez: 'letter' }].
    // Assert waitDocsByIds receives [11] and the row disappears only after both calls succeed.
});

it('docs 생성 실패 시 요청 삭제와 화면 정리를 수행하지 않는다', async () => {
    // Return a Postgrest-shaped error from docs insert.
    // Assert waitDocsByIds is not called and the selected row remains.
});

it('요청 삭제 실패 시 선택과 행을 유지한다', async () => {
    // Let docs insert succeed and waitDocsByIds fail.
    // Assert the selected row remains and an error modal is visible.
});

it('선택한 요청을 반려하고 성공 후 행을 제거한다', async () => {
    // Select request 22 and click "선택 거절".
    // Assert waitDocsByIds receives [22] and the row disappears.
});
```

- [ ] **Step 2: Run the characterization test and verify it passes against the legacy implementation**

Run:

```bash
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx --runInBand
```

Expected: PASS. If an assertion exposes a discrepancy, record the actual observable behavior and adjust only the test description; do not change production code in this task.

- [ ] **Step 3: Commit the safety net**

```bash
git add src/__tests__/admin/request-docs/RequestDocsHome.test.tsx
git commit -m "test: characterize admin docs request moderation"
```

---

### Task 2: Add Docs Request Moderation Domain and Application Contracts

**Files:**
- Create: `src/modules/docs/domain/docs-request-moderation.ts`
- Create: `src/modules/docs/application/docs-request-moderation-types.ts`
- Create: `src/modules/docs/application/docs-request-moderation-ports.ts`
- Create: `src/modules/docs/application/moderate-docs-requests.ts`
- Create: `src/__tests__/modules/docs/domain/docs-request-moderation.test.ts`
- Create: `src/__tests__/modules/docs/application/moderate-docs-requests.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ok`, and `err` from `src/shared/application/result.ts`.
- Produces: `ApproveDocsRequestsCommand`, `RejectDocsRequestsCommand`, `DocsRequestModerationResult`, `DocsRequestModerationGateway`, and `ModerateDocsRequestsService`.

- [ ] **Step 1: Write failing Domain normalization tests**

Test the wished-for API:

```ts
expect(normalizeApproveDocsRequestsCommand({
    selections: [
        { requestId: 22, duem: false },
        { requestId: 11, duem: true },
    ],
})).toEqual(ok({
    selections: [
        { requestId: 11, duem: true },
        { requestId: 22, duem: false },
    ],
}));

expect(normalizeRejectDocsRequestsCommand({ requestIds: [22, 11] }))
    .toEqual(ok({ requestIds: [11, 22] }));
```

Add separate tests for an empty list, 31 entries, ID `0`, ID greater than `Number.MAX_SAFE_INTEGER`, duplicate IDs, and non-boolean approval `duem` supplied through an `unknown` cast.

- [ ] **Step 2: Run Domain tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/domain/docs-request-moderation.test.ts --runInBand
```

Expected: FAIL because `src/modules/docs/domain/docs-request-moderation.ts` does not exist.

- [ ] **Step 3: Implement minimal Domain command validation**

Define these public types and functions:

```ts
export type ApproveDocsRequestSelection = { requestId: number; duem: boolean };
export type ApproveDocsRequestsCommand = { selections: ApproveDocsRequestSelection[] };
export type RejectDocsRequestsCommand = { requestIds: number[] };

export function normalizeApproveDocsRequestsCommand(
    command: ApproveDocsRequestsCommand,
): Result<ApproveDocsRequestsCommand>;

export function normalizeRejectDocsRequestsCommand(
    command: RejectDocsRequestsCommand,
): Result<RejectDocsRequestsCommand>;
```

Use explicit `unknown` narrowing, require 1–30 items, reject duplicates, validate positive safe integers and booleans, and sort by request ID. Return validation messages naming the relevant field (`selections`, `requestIds`, `requestId`, or `duem`).

- [ ] **Step 4: Run Domain tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing Application service tests with a small fake gateway**

Define a fake implementing the planned port and verify exact normalized commands:

```ts
interface DocsRequestModerationGateway {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
}

type DocsRequestModerationResult = {
    processedRequestIds: number[];
    processedRequestCount: number;
};
```

Test that `approve` and `reject` sort input before calling the gateway, validation failure does not call the gateway, and a gateway conflict is returned unchanged.

- [ ] **Step 6: Run Application tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/moderate-docs-requests.test.ts --runInBand
```

Expected: FAIL because the Application files and service do not exist.

- [ ] **Step 7: Implement the minimal Application types, port, and service**

The service API is:

```ts
export class ModerateDocsRequestsService {
    constructor(private readonly gateway: DocsRequestModerationGateway) {}

    async approve(
        command: ApproveDocsRequestsCommand,
    ): Promise<Result<DocsRequestModerationResult>> {
        const normalized = normalizeApproveDocsRequestsCommand(command);
        return normalized.ok ? this.gateway.approve(normalized.value) : normalized;
    }

    async reject(
        command: RejectDocsRequestsCommand,
    ): Promise<Result<DocsRequestModerationResult>> {
        const normalized = normalizeRejectDocsRequestsCommand(command);
        return normalized.ok ? this.gateway.reject(normalized.value) : normalized;
    }
}
```

- [ ] **Step 8: Run Domain and Application tests and verify GREEN**

```bash
npx jest src/__tests__/modules/docs/domain/docs-request-moderation.test.ts src/__tests__/modules/docs/application/moderate-docs-requests.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit the contracts**

```bash
git add src/modules/docs/domain src/modules/docs/application src/__tests__/modules/docs/domain src/__tests__/modules/docs/application
git commit -m "feat: define docs request moderation contracts"
```

---

### Task 3: Add Atomic Docs Request Moderation RPCs

**Files:**
- Create: `supabase/migrations/20260822130000_admin_docs_request_moderation.sql`
- Create: `supabase/tests/database/docs-request-moderation.integration.sql`
- Create: `supabase/tests/database/docs-request-moderation-concurrency.integration.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: Existing `public.users`, `public.docs_wait`, `public.docs`, `auth.uid()`, and enum value `public.document_type = 'letter'`.
- Produces: `public.approve_docs_requests(jsonb) -> jsonb`, `public.reject_docs_requests(jsonb) -> jsonb`, and `npm run test:docs-request-moderation-db`.

- [ ] **Step 1: Add the failing pgTAP behavior test**

Cover authorization, validation, approval, rejection, and rollback. Use reserved fixture UUIDs/names and clean them before and after the test. Core assertions must include:

```sql
select throws_ok(
    $$ select public.approve_docs_requests('[{"requestId": 1, "duem": false}]'::jsonb) $$,
    'P0001',
    'DOCS_REQUEST_MODERATION_UNAUTHORIZED'
);

select is(
    public.approve_docs_requests(
        '[{"requestId": 910001, "duem": true}]'::jsonb
    )->>'processedRequestCount',
    '1'
);

select ok(
    exists (
        select 1 from public.docs
        where name = 'docs-request-moderation-test-a'
          and duem is true
          and typez = 'letter'
    ),
    'approval creates the requested docs row'
);

select ok(
    not exists (select 1 from public.docs_wait where id = 910001),
    'approval removes the wait row in the same transaction'
);
```

Force a unique-name conflict and verify the selected wait row remains. Include empty, 31-item, duplicate-ID, missing-row, non-admin, and malformed payload cases.

- [ ] **Step 2: Add the failing concurrency pgTAP test**

Use `dblink` and two independent authenticated sessions to race approval and rejection for the same request. Assert exactly one succeeds, the wait row is gone once, and the docs side effect is either zero or one according to the winning action—never duplicated.

- [ ] **Step 3: Add the package script and run DB tests to verify RED**

Add:

```json
"test:docs-request-moderation-db": "supabase test db --local supabase/tests/database/docs-request-moderation.integration.sql supabase/tests/database/docs-request-moderation-concurrency.integration.sql"
```

Run only against local Supabase:

```bash
supabase start
npm run test:docs-request-moderation-db
```

Expected: FAIL because the RPC functions do not exist. If the local bootstrap is unavailable, preserve the nonzero failure output as evidence and continue with static SQL review; never substitute a remote database.

- [ ] **Step 4: Implement hardened private helpers and public RPCs**

The migration must be wrapped in `begin; ... commit;`, use schema-qualified references, and contain:

```sql
create schema if not exists private;

create or replace function private.assert_docs_request_moderation_admin()
returns uuid
language plpgsql
security invoker
set search_path = '';

create or replace function public.approve_docs_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = '';

create or replace function public.reject_docs_requests(p_request_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = '';
```

Both public functions must:

- call the admin assertion before touching data;
- validate a JSON array of 1–30 items and reject duplicate IDs;
- reject values outside `1..9007199254740991`;
- lock rows in request-ID order using `FOR UPDATE`;
- compare the locked row count to the input count and raise `DOCS_REQUEST_MODERATION_CONFLICT` on mismatch;
- catch unexpected exceptions only at the public boundary, preserve the five known public codes, and map all other errors to `DOCS_REQUEST_MODERATION_INTERNAL_ERROR`;
- return `{ "processedRequestIds": [...], "processedRequestCount": N }` with IDs sorted ascending.

Approval must insert from the locked trusted rows, with `maker = req_by`, `typez = 'letter'`, and `duem` joined by request ID, then delete the same rows. Rejection deletes only after all target rows have been locked and counted.

Apply minimum privileges:

```sql
revoke all on function public.approve_docs_requests(jsonb) from public, anon;
revoke all on function public.reject_docs_requests(jsonb) from public, anon;
grant execute on function public.approve_docs_requests(jsonb) to authenticated;
grant execute on function public.reject_docs_requests(jsonb) to authenticated;
```

- [ ] **Step 5: Run behavior and concurrency tests and verify GREEN**

```bash
npm run test:docs-request-moderation-db
```

Expected: PASS with all pgTAP assertions. Regardless of outcome, stop the local stack:

```bash
supabase stop
```

- [ ] **Step 6: Perform static SQL safety checks**

```bash
rg -n "security definer|set search_path = ''|revoke all|grant execute|auth.uid\(\)|FOR UPDATE" supabase/migrations/20260822130000_admin_docs_request_moderation.sql
git diff --check
```

Expected: both RPCs are hardened and no whitespace errors are reported.

- [ ] **Step 7: Commit the database boundary**

```bash
git add package.json supabase/migrations/20260822130000_admin_docs_request_moderation.sql supabase/tests/database/docs-request-moderation.integration.sql supabase/tests/database/docs-request-moderation-concurrency.integration.sql
git commit -m "feat: add atomic docs request moderation"
```

---

### Task 4: Add the Browser Gateway, Composition Root, and Presentation Hook

**Files:**
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-request-moderation-gateway.ts`
- Create: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Create: `src/modules/docs/presentation/use-docs-request-moderation.ts`
- Create: `src/modules/docs/index.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-request-moderation-gateway.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-docs-request-moderation.test.tsx`

**Interfaces:**
- Consumes: Task 2 Application service/port/types, shared `browserSupabaseClient`, `mapSupabaseError`, React Query.
- Produces: `SupabaseDocsRequestModerationGateway`, `createBrowserDocsServices`, and public `useDocsRequestModeration` API.

- [ ] **Step 1: Write failing gateway tests**

Use an injected RPC client and verify:

```ts
await gateway.approve({ selections: [{ requestId: 11, duem: true }] });
expect(rpc).toHaveBeenCalledWith('approve_docs_requests', {
    p_selections: [{ requestId: 11, duem: true }],
});

await gateway.reject({ requestIds: [11, 22] });
expect(rpc).toHaveBeenCalledWith('reject_docs_requests', {
    p_request_ids: [11, 22],
});
```

Add success parsing tests for sorted unique positive IDs and matching count. Reject duplicate IDs, mismatched count, negative IDs, non-object data, and thrown RPC calls as infrastructure errors. Verify all five public DB codes map to the intended `ApplicationError.kind` and safe message.

- [ ] **Step 2: Run gateway tests and verify RED**

```bash
npx jest src/__tests__/modules/docs/infrastructure/browser/supabase-docs-request-moderation-gateway.test.ts --runInBand
```

Expected: FAIL because the gateway does not exist.

- [ ] **Step 3: Implement the minimal RPC adapter**

Use an injected structural interface instead of exposing Supabase types:

```ts
interface DocsRequestModerationRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<{
        data: unknown;
        error: { code?: string | null; message: string } | null;
    }>;
}
```

Implement `approve`, `reject`, public-code mapping, and strict result parsing. Default the client to `browserSupabaseClient` only inside Infrastructure.

- [ ] **Step 4: Run gateway tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing composition-root and hook tests**

The composition-root test must verify a fresh `ModerateDocsRequestsService` wired to the Supabase gateway. The hook test must inject a fake service and cover approve/reject dispatch, `isPending`, returned validation errors, thrown exceptions converted to a safe infrastructure error, and `clearError`.

The public hook contract is:

```ts
export interface DocsRequestModerationService {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
}

export function useDocsRequestModeration(service?: DocsRequestModerationService): {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
};
```

- [ ] **Step 6: Run composition-root and hook tests and verify RED**

```bash
npx jest src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts src/__tests__/modules/docs/presentation/use-docs-request-moderation.test.tsx --runInBand
```

Expected: FAIL because the files do not exist.

- [ ] **Step 7: Implement composition root, hook, and public barrel**

`createBrowserDocsServices()` returns:

```ts
{
    docsRequestModerationService: new ModerateDocsRequestsService(
        new SupabaseDocsRequestModerationGateway(),
    ),
}
```

The hook follows the existing `useWordRequestModeration` mutation pattern. `src/modules/docs/index.ts` exports only the hook and UI-consumed command/result types; it must not export the Supabase gateway.

- [ ] **Step 8: Run all Task 4 tests and verify GREEN**

```bash
npx jest src/__tests__/modules/docs/infrastructure/browser/supabase-docs-request-moderation-gateway.test.ts src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts src/__tests__/modules/docs/presentation/use-docs-request-moderation.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit the browser feature boundary**

```bash
git add src/modules/docs src/__tests__/modules/docs
git commit -m "feat: add docs request moderation hook"
```

---

### Task 5: Rewire RequestDocsHome and Remove Replaced SCM Mutations

**Files:**
- Modify: `src/app/admin/request-docs/RequestDocsHome.tsx`
- Modify: `src/__tests__/admin/request-docs/RequestDocsHome.test.tsx`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`

**Interfaces:**
- Consumes: `useDocsRequestModeration`, `ApproveDocsRequestsCommand`, and `DocsRequestModerationResult` from `src/modules/docs`.
- Produces: A presentation-only `RequestDocsHome` and removal of unused `docs()` / `waitDocsByIds()` SCM mutation methods.

- [ ] **Step 1: Replace legacy SCM mocks with a failing feature-hook component test**

Mock `../../../modules/docs` and define successful output:

```tsx
jest.mock('../../../modules/docs', () => ({
    useDocsRequestModeration: jest.fn(),
}));

const successfulResult = {
    ok: true as const,
    value: {
        processedRequestIds: [11],
        processedRequestCount: 1,
    },
};
```

Assert approval sends:

```ts
{
    selections: [{ requestId: 11, duem: true }],
}
```

Assert rejection sends:

```ts
{
    requestIds: [22],
}
```

Keep the characterization assertions for success cleanup and failure preservation. Add tests that both buttons are disabled while pending, conflict/unauthorized/forbidden/infrastructure errors display safe Korean messages without the private message, and success removes only IDs returned by the service.

- [ ] **Step 2: Run the component test and verify RED**

```bash
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx --runInBand
```

Expected: FAIL because `RequestDocsHome` still calls SCM and does not use the hook.

- [ ] **Step 3: Rewire the component with minimal presentation logic**

Remove `SCM` and `PostgrestError` imports. Build commands from selected request IDs and use the request's `initial_consonant` when no explicit override exists:

```ts
const command = {
    selections: selectedIds.map((requestId) => {
        const request = docsWaitRequests.find(({ id }) => id === requestId);
        return {
            requestId,
            duem: initialConsonantSettings[requestId]
                ?? request?.initial_consonant
                ?? false,
        };
    }),
};
```

Do not silently omit malformed selected entries; send the identifier boundary to Domain validation. On successful result, remove only `result.value.processedRequestIds`. On failure, keep UI state and map `ApplicationError.kind` to these public messages:

```ts
const publicMessages = {
    validation: error.message,
    conflict: '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
    unauthorized: '로그인이 필요합니다.',
    forbidden: '관리자 권한이 필요합니다.',
    infrastructure: '문서 요청 처리 중 오류가 발생했습니다.',
};
```

Disable both action buttons when no request is selected or `isPending` is true. Use the existing `ErrorModal`; do not expose the private error message for non-validation errors.

- [ ] **Step 4: Run the component test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Prove the SCM methods are unused, then remove them**

```bash
rg -n "docs\(docsInserQuery|waitDocsByIds|SCM\.add\(\)\.docs" src --glob "*.ts" --glob "*.tsx"
```

Expected before removal: only the two SCM declarations/implementations remain; `RequestDocsHome` has no matches. Remove `IAddManager.docs`, `IDeleteManager.waitDocsByIds`, `AddManager.docs`, and `DeleteManager.waitDocsByIds`.

- [ ] **Step 6: Run boundary and regression tests**

```bash
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" src/app/admin/request-docs/RequestDocsHome.tsx
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx src/__tests__/modules/docs --runInBand
```

Expected: the boundary search returns no matches and all tests PASS.

- [ ] **Step 7: Commit the UI migration**

```bash
git add src/app/admin/request-docs/RequestDocsHome.tsx src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts src/__tests__/admin/request-docs/RequestDocsHome.test.tsx
git commit -m "refactor: migrate docs request moderation actions"
```

---

### Task 6: Update Architecture Status and Run Final Verification

**Files:**
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`
- Create: `docs/testing/docs-request-moderation-rpc-integration.md`

**Interfaces:**
- Consumes: Completed Tasks 1–5 and actual verification results.
- Produces: Updated roadmap status and a reproducible local-only DB test guide.

- [ ] **Step 1: Update the roadmap with the completed mutation slice**

Change the summary, Phase 1 target list, progress table, and “당장 처리할 작업” section so that:

- `admin/request-docs` approval/rejection mutation is complete;
- its request-list query remains a legacy SCM read until Phase 4;
- Phase 1 is complete;
- the next feature slice is Phase 2 user word request mutation;
- the new docs moderation migration is pending user/operator-controlled cloud rollout if it has not been applied remotely.

Re-run the snapshot commands and update numeric SCM counts only if their values changed:

```bash
git grep -l -E "import .*SCM" -- "src/**/*.ts" "src/**/*.tsx"
git grep -n -E "\bSCM\." -- "src/**/*.ts" "src/**/*.tsx"
```

- [ ] **Step 2: Document the local DB integration lifecycle**

Create `docs/testing/docs-request-moderation-rpc-integration.md` with exact prerequisites, files under test, the command `npm run test:docs-request-moderation-db`, expected behavior/concurrency coverage, the prohibition on remote/linked targets, and the mandatory `supabase stop` cleanup.

- [ ] **Step 3: Run focused Jest verification**

```bash
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx src/__tests__/modules/docs --runInBand
```

Expected: PASS with no warnings or unhandled errors.

- [ ] **Step 4: Run repository-required static verification**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands exit 0. If a failure is pre-existing, capture the exact command and failure without changing unrelated code.

- [ ] **Step 5: Run the local DB suite and always stop Supabase**

```bash
supabase start
npm run test:docs-request-moderation-db
supabase stop
```

Expected: behavior and concurrency pgTAP files PASS. If local bootstrap or containers block the run, report the exact nonzero output and still execute `supabase stop`; never use a remote project as fallback.

- [ ] **Step 6: Run final architecture and diff checks**

```bash
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" src/app/admin/request-docs/RequestDocsHome.tsx
rg -n "docs\(docsInserQuery|waitDocsByIds" src/app/lib/supabase
git diff --check
git status --short
```

Expected: both legacy-boundary searches return no matches, `git diff --check` is clean, and only intended documentation changes remain before the final commit.

- [ ] **Step 7: Commit documentation and verified status**

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md docs/testing/docs-request-moderation-rpc-integration.md
git commit -m "docs: record docs request moderation rollout"
```

- [ ] **Step 8: Review the complete branch**

Inspect:

```bash
git status --short
git log --oneline --decorate -8
git diff HEAD~6..HEAD --stat
```

Expected: clean worktree, six focused implementation commits after the plan/design commits, and no changes outside the approved mutation slice, supporting module, migration/tests, SCM method removal, and documentation.
