# Docs Request Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the administrator pending docs-request list from `SCM.get().addWaitDocs()` to the existing `modules/docs` DDD-lite boundary without changing moderation behavior.

**Architecture:** Add a read-only application DTO, query gateway port, and query service under `src/modules/docs`. A browser Supabase adapter maps the `docs_wait` join result into the DTO, while a React Query hook owns caching, retries, and typed errors. `RequestDocsWrapper` consumes only that hook and maps the DTO into the unchanged `RequestDocsHome` presentation contract.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, TanStack React Query, Supabase JS, Jest, Testing Library

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Preserve the existing administrator docs-request list and moderation behavior.
- Do not add methods to legacy `SCM` and remove the `SCM` import from `RequestDocsWrapper.tsx`.
- Domain and Application code must not import React, Next.js, Supabase, or generated database types.
- Supabase row shapes and query names must remain inside Infrastructure.
- External or malformed values must be treated as `unknown` and narrowed without `any`.
- User-facing failures must use a stable Korean `ApplicationError` message and must not expose raw Supabase details.
- Use React Query for server-state caching with a docs-specific query key and retry only non-validation failures up to the established project limit.
- Follow strict TDD: write each behavior test, run it and observe the expected failure, then add the minimum production code.
- Do not manually edit `src/app/types/database.types.ts`.
- Update the roadmap to record this completed slice and the remaining legacy `addWaitDocs` consumer.

---

### Task 1: Migrate the pending docs-request list query

**Files:**
- Create: `src/modules/docs/application/docs-request-query-types.ts`
- Create: `src/modules/docs/application/docs-request-query-ports.ts`
- Create: `src/modules/docs/application/get-pending-docs-requests.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-request-query-gateway.ts`
- Create: `src/modules/docs/presentation/docs-query-keys.ts`
- Create: `src/modules/docs/presentation/docs-query-result.ts`
- Create: `src/modules/docs/presentation/use-pending-docs-requests.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-request-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-pending-docs-requests.test.tsx`
- Create: `src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/admin/request-docs/RequestDocsWrapper.tsx`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `PendingDocsRequest` with `id`, `requestedAt`, `docsName`, `requesterNickname`, and `requesterId`.
- Produces: `DocsRequestQueryGateway.loadPending(): Promise<Result<PendingDocsRequest[]>>`.
- Produces: `GetPendingDocsRequestsService.get(): Promise<Result<PendingDocsRequest[]>>`.
- Produces: `usePendingDocsRequests()` backed by query key `['docs', 'requests', 'pending']`.
- Consumes: `browserSupabaseClient`, `Result<T>`, `ApplicationError`, and the existing `DocsWaitManager` `initialData` shape.

- [ ] **Step 1: Write failing Infrastructure adapter tests**

Add tests with a small fake Supabase query builder that prove:

```ts
await expect(gateway.loadPending()).resolves.toEqual(ok([{
    id: 11,
    requestedAt: '2026-08-22T00:00:00.000Z',
    docsName: '가',
    requesterNickname: '신청자 A',
    requesterId: '00000000-0000-0000-0000-000000000011',
}]));
```

The same test must verify the adapter requests only `id, req_at, docs_name, req_by, users(nickname)` from `docs_wait`. Separate tests must prove a null joined user maps to `requesterNickname: null`, and a Supabase error, thrown query, or malformed row returns a stable infrastructure error without leaking the raw message.

- [ ] **Step 2: Run the Infrastructure adapter test and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/infrastructure/browser/supabase-docs-request-query-gateway.test.ts --runInBand
```

Expected: FAIL because the query gateway and application contracts do not exist.

- [ ] **Step 3: Implement the application query contracts and Supabase adapter**

Create the DTO, port, and service with the exact interfaces above. Implement `SupabaseDocsRequestQueryGateway` using an injected client interface for tests and `browserSupabaseClient` by default. Parse the complete selected row as `unknown`, accept `users` only as `{ nickname: string | null } | null`, and return:

```ts
{
    kind: 'infrastructure',
    message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
}
```

for Supabase failures, thrown queries, and malformed data.

- [ ] **Step 4: Run the Infrastructure adapter test and verify GREEN**

Run the Step 2 command and expect all adapter tests to pass.

- [ ] **Step 5: Write failing React Query hook tests**

Mock only `createBrowserDocsServices` and use a real `QueryClient`. Prove the hook caches successful DTOs at `['docs', 'requests', 'pending']`, exposes an `ApplicationError`, does not retry a validation error, and follows the established retry limit for infrastructure errors.

- [ ] **Step 6: Run the hook test and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-pending-docs-requests.test.tsx --runInBand
```

Expected: FAIL because the hook, query key, and query-result helper do not exist.

- [ ] **Step 7: Implement browser composition and the React Query hook**

Add `docsRequestQueryService` to `BrowserDocsServices`, compose it with `SupabaseDocsRequestQueryGateway`, and export the hook and DTO from `src/modules/docs/index.ts`. The query-result helper must preserve valid `ApplicationError` values, convert unexpected throws to the stable docs-list infrastructure error, and retry while `error.kind !== 'validation' && failureCount < 3`.

- [ ] **Step 8: Run the hook and existing docs service tests and verify GREEN**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-pending-docs-requests.test.tsx src/__tests__/modules/docs/infrastructure/browser/browser-docs-services.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Write failing `RequestDocsWrapper` component tests**

Mock the `usePendingDocsRequests` module export and provide a stable no-op `useDocsRequestModeration` result required by the real child component. Render the real `RequestDocsWrapper` and real `RequestDocsHome`, and prove:

- loading renders the existing `LoadingPage` title;
- successful camelCase DTOs render their docs name and requester nickname in the existing table;
- a typed infrastructure error renders only its stable message;
- an empty result renders the moderation screen with no request rows.

- [ ] **Step 10: Run the wrapper test and verify RED**

Run:

```bash
npx jest src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx --runInBand
```

Expected: FAIL because `RequestDocsWrapper` still calls `SCM` and does not consume the hook.

- [ ] **Step 11: Migrate `RequestDocsWrapper` and update the roadmap**

Replace its effect/state/PostgREST handling with `usePendingDocsRequests`. Map each DTO to the unchanged `DocsWaitManager` shape:

```ts
{
    id: request.id,
    req_at: request.requestedAt,
    docs_name: request.docsName,
    req_by: request.requesterNickname,
    initial_consonant: false,
    req_byId: request.requesterId,
}
```

Remove the `SCM`, Supabase type, and manual loading-state imports. Update the roadmap summary, dependency table, Phase 4 note, progress table, and immediate-work list so they state that the admin pending request list query is migrated while `WordsDocsHome.tsx` remains a legacy `addWaitDocs` read consumer.

- [ ] **Step 12: Run focused tests and verify GREEN**

Run:

```bash
npx jest src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx src/__tests__/admin/request-docs/RequestDocsHome.test.tsx src/__tests__/modules/docs --runInBand
```

Expected: PASS with no new warnings.

- [ ] **Step 13: Run required repository verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
git diff --check
```

Expected: all commands exit successfully. The known baseline Next.js multiple-lockfile warning and existing `TryRenderImg` console warning may still appear; no new warning may be introduced.

- [ ] **Step 14: Commit the vertical slice**

```bash
git add docs/superpowers/plans/2026-08-25-docs-request-query.md docs/architecture/ddd-lite-migration-roadmap.md src/app/admin/request-docs/RequestDocsWrapper.tsx src/modules/docs src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx src/__tests__/modules/docs
git commit -m "refactor: migrate pending docs request query"
```
