# Docs Read Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move five remaining `words-docs` read flows from legacy `SCM` orchestration into the `modules/docs` DDD-lite query boundary without changing existing mutations or UI behavior.

**Architecture:** Each screen receives a purpose-built Application DTO through a small query service and gateway port. Browser Supabase adapters own table names, row narrowing, and mapping, while React Query hooks own cache and retry state. The five slices are implemented in separate worktrees and merged sequentially into `refactor/db` so each later slice builds on the reviewed previous result.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, TanStack React Query, Supabase JS, Jest, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-25-docs-read-boundaries-design.md`

## Global Constraints

- Preserve the existing docs list, duplicate-request validation, logs, info, content, loading, error, not-found, sorting, filtering, pagination, and mutation behavior.
- Do not migrate `waitDocs`, `docView`, `starDocs`, `startDocs`, or any other docs mutation before Phase 0B.
- Do not add methods to legacy `SCM`; remove only getters whose final production consumer disappears in the current task.
- Domain and Application code must not import React, Next.js, Supabase, or generated database types.
- Supabase table, column, row, and raw error shapes must remain inside Infrastructure.
- Treat external and malformed values as `unknown`, narrow them without `any`, and return stable Korean `ApplicationError` messages without raw Supabase details.
- Use `docsQueryKeys`; do not retry validation errors and retry Infrastructure errors only under the existing `retryDocsQuery` policy.
- Keep DB schema, RPCs, migrations, and `src/app/types/database.types.ts` unchanged.
- Follow strict TDD: write a behavior test, run it and observe the expected failure, then add the minimum production code.
- Update `docs/architecture/ddd-lite-migration-roadmap.md` after each completed slice so it describes the actual remaining boundary.
- Run focused Jest, `npm run lint`, `npx tsc --noEmit`, and `git diff --check` before committing each task.

---

### Task 1: Replace the legacy pending-request duplicate read

**Files:**
- Create: `src/__tests__/words-docs/WordsDocsHome.test.tsx`
- Modify: `src/app/words-docs/WordsDocsHome.tsx`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: `usePendingDocsRequests()` returning React Query `data`, `error`, and `refetch` for `PendingDocsRequest[]`.
- Preserves: legacy `SCM.get().letterDocs()` and `SCM.add().waitDocs()` because they are outside this read slice.
- Removes: `ISupabaseGetManager.addWaitDocs()` and `SupabaseGetManager.addWaitDocs()` after the final production consumer is gone.

- [ ] **Step 1: Write the failing submit-time duplicate test**

Mock `usePendingDocsRequests`, Redux user state, `SCM.get().letterDocs`, and `SCM.add().waitDocs`. Render `WordsDocsHome` with an empty docs list, open “새 문서 추가 요청”, enter `가`, and submit. Configure `refetch` to return:

```ts
{
    data: [{
        id: 7,
        requestedAt: '2026-08-25T00:00:00.000Z',
        docsName: '가',
        requesterNickname: '요청자',
        requesterId: 'user-7',
    }],
    error: null,
}
```

Assert that `refetch` is called at submit time, “이미 추가 요청된 문서명입니다.” is rendered, and `SCM.add().waitDocs` is not called. A separate test must return `{ data: undefined, error: { kind: 'infrastructure', message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.' } }` and assert only that stable message is shown.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npx jest src/__tests__/words-docs/WordsDocsHome.test.tsx --runInBand
```

Expected: FAIL because the component still calls `SCM.get().addWaitDocs()` and does not use the docs query hook.

- [ ] **Step 3: Replace the duplicate read and delete the obsolete getter**

Call `usePendingDocsRequests()` once at component render and use its `refetch()` result inside `handleAddDocRequest`. Preserve the existing `letterDocs` duplicate check and `waitDocs` mutation. Match pending requests with:

```ts
pendingResult.data?.some((request) => request.docsName === newDocName)
```

On `pendingResult.error` or missing data, show the stable error message and stop submission. Remove the `addWaitDocs` interface method, implementation, and obsolete test mocks. Update the roadmap to say `WordsDocsHome.tsx` no longer consumes the legacy pending-request getter while its existing create-request mutation remains legacy.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx jest src/__tests__/words-docs/WordsDocsHome.test.tsx src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx src/__tests__/modules/docs/presentation/use-pending-docs-requests.test.tsx --runInBand
```

Expected: PASS and no production `addWaitDocs()` call remains.

- [ ] **Step 5: Run required verification and commit**

Run:

```bash
npm run lint
npx tsc --noEmit
git diff --check
git grep -n "addWaitDocs" -- src/app src/modules
```

Expected: lint/typecheck/diff check pass; grep returns no production call or declaration. Commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs/WordsDocsHome.tsx src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts src/__tests__/words-docs/WordsDocsHome.test.tsx src/__tests__/admin/request-docs/RequestDocsWrapper.test.tsx
git commit -m "refactor: migrate docs request duplicate query"
```

---

### Task 2: Migrate the docs list query

**Files:**
- Create: `src/modules/docs/application/docs-list-query-types.ts`
- Create: `src/modules/docs/application/docs-list-query-ports.ts`
- Create: `src/modules/docs/application/get-docs-list.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-list-query-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-list.ts`
- Create: `src/__tests__/modules/docs/application/get-docs-list.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-list-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-docs-list.test.tsx`
- Create: `src/__tests__/words-docs/WordsDocsHomePage.test.tsx`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/presentation/docs-query-keys.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/WordsDocsHomePage.tsx`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `DocsSummary` with `id`, `name`, `makerNickname`, `lastUpdatedAt`, `createdAt`, and `type`.
- Produces: `DocsListQueryGateway.loadAll(): Promise<Result<DocsSummary[]>>`.
- Produces: `GetDocsListService.get(): Promise<Result<DocsSummary[]>>`.
- Produces: `useDocsList()` at `docsQueryKeys.list` (`['docs', 'list']`).
- Preserves: legacy `allDocs()` because admin logs and direct word addition still consume it.

- [ ] **Step 1: Write failing Application and adapter tests**

The service test must prove it returns the gateway `ok` and `err` unchanged. The adapter test must inject a fake builder and prove it selects the current docs fields and maker nickname, then maps:

```ts
{
    id: 31,
    name: '가',
    makerNickname: null,
    lastUpdatedAt: '2026-08-25T01:00:00.000Z',
    createdAt: '2026-08-20T01:00:00.000Z',
    type: 'letter',
}
```

Separate adapter tests must cover a nickname, all three allowed `typez` values, a Supabase error, a thrown query, and malformed rows. Failures must return `{ kind: 'infrastructure', message: '문서 목록을 불러오는 중 오류가 발생했습니다.' }`.

- [ ] **Step 2: Run the Application and adapter tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/get-docs-list.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-list-query-gateway.test.ts --runInBand
```

Expected: FAIL because list contracts and adapter do not exist.

- [ ] **Step 3: Implement the list contracts and adapter**

Use these exact contracts:

```ts
export type DocsType = 'letter' | 'theme' | 'ect';

export interface DocsSummary {
    id: number;
    name: string;
    makerNickname: string | null;
    lastUpdatedAt: string;
    createdAt: string;
    type: DocsType;
}

export interface DocsListQueryGateway {
    loadAll(): Promise<Result<DocsSummary[]>>;
}
```

Implement a service delegating to the gateway and an injected Supabase client adapter. Validate safe positive integer ids, strings, allowed type values, and nullable joined user/nickname before mapping.

- [ ] **Step 4: Write failing hook and page tests**

Hook tests use a real `QueryClient` and mocked `createBrowserDocsServices` to prove the exact key, DTO caching, stable errors, no retry for validation, and the existing Infrastructure retry limit. Page tests mock only `useDocsList` and render the real child. Prove loading title “문서 목록”, stable error text, empty list rendering, and mapping `id: 31` to child prop `id: '31'` with maker fallback “알수없음”.

- [ ] **Step 5: Run hook and page tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-docs-list.test.tsx src/__tests__/words-docs/WordsDocsHomePage.test.tsx --runInBand
```

Expected: FAIL because the hook does not exist and the page still calls SCM.

- [ ] **Step 6: Compose the service, add the hook, and migrate the page**

Add `docsListQueryService` to `BrowserDocsServices`, export the contracts and hook, and extend query keys with:

```ts
all: ['docs'] as const,
list: ['docs', 'list'] as const,
```

Replace the page effect/state/PostgREST error assembly with `useDocsList()`. Map DTOs to the unchanged `WordsDocsHome` prop names and remove the SCM import.

- [ ] **Step 7: Run focused and required verification, update roadmap, and commit**

Run:

```bash
npx jest src/__tests__/words-docs/WordsDocsHomePage.test.tsx src/__tests__/modules/docs --runInBand
npm run lint
npx tsc --noEmit
git diff --check
```

Update Phase 4 and the progress table to mark the public docs list query complete. Commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs/WordsDocsHomePage.tsx src/modules/docs src/__tests__/modules/docs src/__tests__/words-docs/WordsDocsHomePage.test.tsx
git commit -m "refactor: migrate docs list query"
```

---

### Task 3: Migrate the docs log projection query

**Files:**
- Create: `src/modules/docs/application/docs-log-query-types.ts`
- Create: `src/modules/docs/application/docs-log-query-ports.ts`
- Create: `src/modules/docs/application/get-docs-logs.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-log-query-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-logs.ts`
- Create: `src/__tests__/modules/docs/application/get-docs-logs.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-log-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-docs-logs.test.tsx`
- Create: `src/__tests__/words-docs/id/logs/DocsLogPage.test.tsx`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/presentation/docs-query-keys.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/[id]/logs/DocsLogPage.tsx`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `DocsLogEntry`, `DocsLogProjection`, `DocsLogQueryGateway.loadByDocsId(id)`, `GetDocsLogsService.get(id)`, and `useDocsLogs(id)`.
- Uses: `docsQueryKeys.logs(id)` equal to `['docs', id, 'logs']`.
- Removes: legacy `docsLogs(id)` after the page migrates.

- [ ] **Step 1: Write failing service and adapter tests**

Service tests must reject `0`, negative, fractional, and unsafe integer ids with `{ kind: 'validation', message: '올바른 문서 ID가 필요합니다.' }`, convert gateway `ok(null)` to `{ kind: 'not-found', message: '문서를 찾을 수 없습니다.' }`, and preserve success/error. Adapter tests must prove docs metadata is read first, missing docs returns `ok(null)` without a logs query, and rows map to:

```ts
{
    docsId: 41,
    docsName: '나',
    entries: [{
        id: 9,
        word: '나라',
        userNickname: null,
        occurredAt: '2026-08-25T02:00:00.000Z',
        type: 'add',
    }],
}
```

Cover `add`/`delete`, nullable users, malformed rows, each query error, and thrown queries with the stable message “문서 로그를 불러오는 중 오류가 발생했습니다.”

- [ ] **Step 2: Run service and adapter tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/get-docs-logs.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-log-query-gateway.test.ts --runInBand
```

Expected: FAIL because log contracts do not exist.

- [ ] **Step 3: Implement log contracts and adapter**

Use the exact DTOs from the spec. Define `loadByDocsId(docsId: number): Promise<Result<DocsLogProjection | null>>`. Keep the existing manager ordering by issuing the same logs order clause found in `SupabaseClientManager.docsLogs`; do not reorder in presentation.

- [ ] **Step 4: Write failing hook and page tests**

Hook tests prove key/service/retry behavior. Page tests mock `useDocsLogs` and prove loading, stable error, not-found, empty entries, and successful props including `undefined` for a null nickname.

- [ ] **Step 5: Run hook and page tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-docs-logs.test.tsx src/__tests__/words-docs/id/logs/DocsLogPage.test.tsx --runInBand
```

Expected: FAIL because the hook is missing and the page still uses SCM.

- [ ] **Step 6: Compose the service, migrate the page, and remove the getter**

Add the service to browser composition, export it, add the query key, and replace manual effect/loading/error state with the hook. Map `userNickname ?? undefined` and `occurredAt` to existing `DocsLogs` prop names. Remove `PostgrestError`, SCM, `docsLogs()` interface, and manager implementation.

- [ ] **Step 7: Verify, update roadmap, and commit**

Run:

```bash
npx jest src/__tests__/words-docs/id/logs/DocsLogPage.test.tsx src/__tests__/modules/docs --runInBand
npm run lint
npx tsc --noEmit
git diff --check
git grep -n "docsLogs(" -- src/app src/modules
```

Expected grep matches only the new feature names or no legacy manager call. Update the roadmap and commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs/[id]/logs/DocsLogPage.tsx src/app/lib/supabase src/modules/docs src/__tests__/modules/docs src/__tests__/words-docs/id/logs/DocsLogPage.test.tsx
git commit -m "refactor: migrate docs log query"
```

---

### Task 4: Migrate the docs information projection query

**Files:**
- Create: `src/modules/docs/application/docs-info-query-types.ts`
- Create: `src/modules/docs/application/docs-info-query-ports.ts`
- Create: `src/modules/docs/application/get-docs-info.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-info-query-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-info.ts`
- Create: `src/__tests__/modules/docs/application/get-docs-info.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-info-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-docs-info.test.tsx`
- Create: `src/__tests__/words-docs/id/info/DocsInfoPage.test.tsx`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/presentation/docs-query-keys.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/[id]/info/DocsInfoPage.tsx`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `DocsInfoProjection` exactly as specified, with camelCase metadata.
- Produces: `DocsInfoQueryGateway.loadByDocsId(id): Promise<Result<DocsInfoProjection | null>>`.
- Produces: `GetDocsInfoService.get(id)` and `useDocsInfo(id)` at `['docs', id, 'info']`.
- Removes: `docsStarCount`, `docsWordCount`, and misspelled legacy `docsVeiwRankByDocsId` getters.

- [ ] **Step 1: Write failing service and adapter tests**

Reuse the exact id validation and not-found messages from Task 3. Adapter tests must cover:

```ts
{
    metadata: {
        id: 51,
        createdAt: '2026-08-01T00:00:00.000Z',
        name: '다',
        makerNickname: '제작자',
        type: 'letter',
        lastUpdatedAt: '2026-08-25T03:00:00.000Z',
        views: 120,
    },
    wordCount: 32,
    starCount: 4,
    viewRank: 2,
}
```

Add separate cases for theme lookup/count, supported legacy ect ids `201` and `202`, unsupported ect returning `ok(null)`, null maker, null count mapping to `-1`, malformed rows, every query error, and thrown queries. Stable failure message: “문서 정보를 불러오는 중 오류가 발생했습니다.”

- [ ] **Step 2: Run service and adapter tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/get-docs-info.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-info-query-gateway.test.ts --runInBand
```

Expected: FAIL because info contracts do not exist.

- [ ] **Step 3: Implement info contracts and adapter**

Implement the exact DTO and port. The adapter owns the current letter/theme/ect branch logic, theme lookup, word count, star count, and view-rank query. Isolate `201`/`202` compatibility in a named Infrastructure constant; do not introduce those ids into Domain/Application.

- [ ] **Step 4: Write failing hook and page tests**

Hook tests prove key/service/retry behavior. Page tests prove loading title “문서 정보”, stable error, not-found, and mapping camelCase metadata back to current `DocsInfo` props (`created_at`, `last_update`, `typez`, nullable `users`).

- [ ] **Step 5: Run hook and page tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-docs-info.test.tsx src/__tests__/words-docs/id/info/DocsInfoPage.test.tsx --runInBand
```

Expected: FAIL because the hook is absent and the page orchestrates SCM calls.

- [ ] **Step 6: Compose, migrate, and remove obsolete getters**

Add service/hook/export/key, migrate the page, and remove its manual effects, `PostgrestError`, SCM, and loading progress code. Remove only `docsStarCount`, `docsWordCount`, and `docsVeiwRankByDocsId`; keep metadata/theme getters for Task 5.

- [ ] **Step 7: Verify, update roadmap, and commit**

Run:

```bash
npx jest src/__tests__/words-docs/id/info/DocsInfoPage.test.tsx src/__tests__/modules/docs --runInBand
npm run lint
npx tsc --noEmit
git diff --check
git grep -n -E "docsStarCount|docsWordCount|docsVeiwRankByDocsId" -- src/app src/modules
```

Expected: no legacy declarations or production calls. Update the roadmap and commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs/[id]/info/DocsInfoPage.tsx src/app/lib/supabase src/modules/docs src/__tests__/modules/docs src/__tests__/words-docs/id/info/DocsInfoPage.test.tsx
git commit -m "refactor: migrate docs info query"
```

---

### Task 5: Migrate the docs content projection query and refresh

**Files:**
- Create: `src/modules/docs/application/docs-content-query-types.ts`
- Create: `src/modules/docs/application/docs-content-query-ports.ts`
- Create: `src/modules/docs/application/get-docs-content.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-content.ts`
- Create: `src/__tests__/modules/docs/application/get-docs-content.test.ts`
- Create: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts`
- Create: `src/__tests__/modules/docs/presentation/use-docs-content.test.tsx`
- Modify: `src/__tests__/words-docs/id/DocsDataHome.integration.test.tsx`
- Modify: `src/__tests__/words-docs/id/Table.test.tsx`
- Modify: `src/app/words-docs/[id]/DocsDataPage.tsx`
- Modify: `src/app/words-docs/[id]/DocsDataHome.tsx`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/presentation/docs-query-keys.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `DocsContentWord`, `DocsContentProjection`, `DocsContentQueryGateway.loadByDocsId`, `GetDocsContentService.get`, and `useDocsContent(id)` at `['docs', id, 'content']`.
- Consumes: existing `enrichDocsWordData` and `GetDocsWordMutationTargetsService` without importing word-moderation Infrastructure into `modules/docs`.
- Preserves: legacy best-effort `SCM.update().docView`, `SCM.add().starDocs`, and `SCM.delete().startDocs` mutations.
- Removes when unused: read getters `docsWords`, `docsLastUpdate(id)`, `docsStar`, `docsInfoByDocsId`, and `themeInfoByThemeName`; preserves update `docsLastUpdate(docsIds)`.

- [ ] **Step 1: Write failing service and adapter tests**

Service tests reuse id validation/not-found and preserve gateway failures. Adapter tests cover:

- a letter docs projection that removes an approved word with a pending delete and excludes one-character pending rows;
- a theme docs projection with approved/add/delete statuses;
- an ect docs projection and the existing special-range boolean;
- marker docs ids `208`, `223`, and `238` returning an empty word list;
- starred user ids and nullable requesters;
- malformed metadata, word, wait-word, or star rows;
- metadata/theme/words/stars query errors and thrown queries.

The representative projection is:

```ts
{
    metadata: {
        id: 61,
        title: '라',
        lastUpdatedAt: '2026-08-25T04:00:00.000Z',
        type: 'letter',
    },
    starredUserIds: ['user-1'],
    words: [
        { word: '라디오', status: 'ok' },
        { word: '라면', status: 'add', requesterNickname: '요청자' },
    ],
    isSpecial: false,
}
```

Stable failure message: “문서 단어를 불러오는 중 오류가 발생했습니다.”

- [ ] **Step 2: Run service and adapter tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/application/get-docs-content.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts --runInBand
```

Expected: FAIL because content contracts do not exist.

- [ ] **Step 3: Implement content contracts and adapter**

Use the spec DTOs and `loadByDocsId(docsId): Promise<Result<DocsContentProjection | null>>`. Keep all Supabase branch logic in Infrastructure. Use named Infrastructure constants/functions for marker ids and special ranges. Do not sort words in the adapter; preserve the page’s Korean locale sort before rendering.

- [ ] **Step 4: Write failing hook and screen integration tests**

Hook tests prove key/service/retry/refetch behavior. Update screen tests to mock `useDocsContent` and prove:

- loading, stable error, and not-found states;
- DTO words are enriched through the existing mutation-target service and sorted before `DocsDataHome`;
- successful content display triggers legacy `docView` best-effort without turning its failure into a page error;
- an administrator action completion calls the content query `refetch` and replaces the displayed snapshot;
- `DocsDataHome.tsx` no longer calls read `docsLastUpdate` or `docsWords`.

- [ ] **Step 5: Run hook and screen tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/docs/presentation/use-docs-content.test.tsx src/__tests__/words-docs/id/DocsDataHome.integration.test.tsx src/__tests__/words-docs/id/Table.test.tsx --runInBand
```

Expected: FAIL because the hook is missing and the screens still perform legacy reads.

- [ ] **Step 6: Compose the service and migrate initial load and refresh**

Add service/hook/export/key. `DocsDataPage` consumes the hook, runs `enrichDocsWordData` against `data.words`, maps metadata/star ids, and retains only the best-effort view mutation. Pass a refetch callback into `DocsDataHome`; replace the existing direct last-update/word snapshot block in `handleAdminActionComplete` with that callback’s projection result while preserving the completion modal and error Modal behavior.

- [ ] **Step 7: Remove obsolete legacy getters safely**

Search the current merged branch, then remove read `docsWords`, read `docsLastUpdate(id)`, `docsStar`, `docsInfoByDocsId`, and `themeInfoByThemeName` only if they have no production consumer. Keep update `docsLastUpdate(docsIds)` and all mutation methods. Update manager-specific tests to stop testing removed getters; adapter tests now own their behavior.

- [ ] **Step 8: Run focused and full verification, update roadmap, and commit**

Run:

```bash
npx jest src/__tests__/words-docs/id src/__tests__/modules/docs --runInBand
npm run lint
npx tsc --noEmit
npm test -- --runInBand
git diff --check
git grep -n -E "SCM.get\(\).(docsInfoByDocsId|docsStar|docsWords|docsLastUpdate|themeInfoByThemeName)" -- src/app src/modules
```

Expected: focused and full suites pass; no migrated production read remains. Update the roadmap summary, Phase 4, progress table, and immediate-work list to mark these five read slices complete and name the next remaining docs read or Phase 0B prerequisite. Commit:

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md src/app/words-docs src/app/lib/supabase src/modules/docs src/__tests__/modules/docs src/__tests__/words-docs
git commit -m "refactor: migrate docs content query"
```
