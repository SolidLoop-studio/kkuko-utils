# Admin Word Request Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `admin/request-words`의 승인·반려 mutation을 식별자 기반 command와 원자적인 Supabase RPC로 이전하여 부분 성공과 중복 side effect를 제거한다.

**Architecture:** 기존 `word-moderation` module에 Domain 정규화, Application service/port, Supabase browser gateway, React Query hook을 추가한다. 승인과 반려는 각각 하나의 `security definer` RPC transaction이며 DB가 관리자, 대기 요청, 요청자, 단어와 주제를 다시 검증한다. `AdminRequestHome`은 선택을 command로 바꾸고 성공 후에만 상태 초기화와 목록 새로고침을 수행한다.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, React Query, Jest, Testing Library, Supabase/PostgreSQL PL/pgSQL, pgTAP

**Spec:** `docs/superpowers/specs/2026-08-21-admin-word-request-moderation-design.md`

## Global Constraints

- 이번 세로 슬라이스는 `AdminRequestHome.tsx`의 승인·반려 mutation만 이전한다. `AdminWrapper.tsx`와 `ThemeSelectModal.tsx`의 read-side SCM은 유지한다.
- `AdminRequestHome.tsx`의 `allThemes` 조회는 새 command가 ID만 사용하므로 대체하지 않고 제거한다.
- 한 command는 1개 이상 30개 이하의 selection을 가지며 한 RPC transaction에서 전부 성공하거나 전부 rollback한다.
- operation table, IndexedDB, payload hash, 재개, 취소와 batch orchestration을 추가하지 않는다.
- 클라이언트의 단어, 요청자, 관리자 UUID, 주제 코드와 이름을 신뢰하지 않는다. DB가 식별자로 다시 조회하고 `auth.uid()`를 actor로 사용한다.
- DB 잠금의 전역 순서는 기존 삭제 RPC와 맞춰 `words -> wait_words -> word_themes_wait -> word_themes`로 한다. 각 table 안에서는 key 오름차순을 사용한다.
- 추가 요청 승인은 선택한 주제만 연결한 뒤 전체 `wait_words` 요청을 제거한다. 주제 변경은 선택한 대기 행만 처리하고 나머지는 유지한다.
- 반려한 단어 추가·삭제 요청은 `logs`에 기록한다. 반려한 주제 변경은 단어 로그, docs 로그와 기여도를 만들지 않는다.
- 공개 DB 오류는 `WORD_REQUEST_MODERATION_UNAUTHORIZED`, `WORD_REQUEST_MODERATION_FORBIDDEN`, `WORD_REQUEST_MODERATION_INVALID_INPUT`, `WORD_REQUEST_MODERATION_CONFLICT`, `WORD_REQUEST_MODERATION_INTERNAL_ERROR`로 제한한다.
- UI에는 raw PostgREST 오류, SQLSTATE, `cause` 또는 DB payload를 표시하지 않는다. `alert`와 `confirm`을 사용하지 않고 프로젝트 Modal을 사용한다.
- 실패 시 선택을 유지하고 성공 시에만 선택을 초기화한 뒤 `refreshFn()`을 실행한다. mutation 실행 중 승인과 반려 버튼을 모두 비활성화한다.
- `src/app/types/database.types.ts`를 수동 편집하지 않는다. 원격 schema를 바꾸지 않는 이 작업에서는 새 RPC transport를 Infrastructure 내부의 좁은 타입으로 격리한다.
- legacy SCM 메서드는 다른 화면이 사용 중이므로 삭제하지 않는다. 이번 완료 기준은 `AdminRequestHome.tsx`에서 관련 SCM import와 호출을 제거하는 것이다.
- DB 변경은 `20260821130000_admin_word_request_moderation.sql` forward migration으로 추가하고 기존 migration을 수정하지 않는다.
- 테스트는 실제 동작을 검증하며 source text grep을 Jest assertion으로 만들지 않는다. architecture boundary는 리뷰와 별도 `rg` 명령으로 검증한다.
- local Supabase를 시작한 작업자는 성공·실패와 관계없이 종료 시 `supabase stop`을 실행한다.

---

### Task 1: Domain normalization and Application contract

**Files:**
- Create: `src/modules/word-moderation/domain/word-request-moderation.ts`
- Create: `src/modules/word-moderation/application/word-request-moderation-types.ts`
- Create: `src/modules/word-moderation/application/moderate-word-requests.ts`
- Modify: `src/modules/word-moderation/application/ports.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Test: `src/__tests__/modules/word-moderation/domain/word-request-moderation.test.ts`
- Test: `src/__tests__/modules/word-moderation/application/moderate-word-requests.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ok`, `err`, `ApplicationError` from `src/shared/application`.
- Produces: `ModerateWordRequestsCommand`, `WordRequestModerationSelection`, `WordRequestModerationResult`, `WordRequestModerationGateway`, `ModerateWordRequestsService`, `normalizeWordRequestModerationCommand`.

- [ ] **Step 1: Write failing Domain tests for validation and deterministic normalization**

Write literal expectations that cover the real breaks: empty selection accepted, 31 selections accepted, unsafe/non-positive IDs accepted, duplicate request IDs accepted, duplicate or contradictory theme changes accepted, and nondeterministic ordering.

```ts
const command: ModerateWordRequestsCommand = {
    selections: [
        {
            kind: 'theme-change',
            wordId: 9,
            changes: [
                { themeId: 4, type: 'delete' },
                { themeId: 2, type: 'add' },
            ],
        },
        {
            kind: 'word-request',
            requestId: 3,
            selectedThemeIds: [8, 2, 8],
        },
    ],
};

expect(normalizeWordRequestModerationCommand(command)).toEqual(ok({
    selections: [
        { kind: 'word-request', requestId: 3, selectedThemeIds: [2, 8] },
        {
            kind: 'theme-change',
            wordId: 9,
            changes: [
                { themeId: 2, type: 'add' },
                { themeId: 4, type: 'delete' },
            ],
        },
    ],
}));
```

For contradictory changes, assert that `{ wordId: 9, themeId: 2, type: 'add' }` together with the same key and `type: 'delete'` returns a `validation` error. Repeated `selectedThemeIds` inside one word request are deduplicated, while a repeated top-level `requestId` is rejected.

- [ ] **Step 2: Run Domain tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/word-moderation/domain/word-request-moderation.test.ts --runInBand
```

Expected: FAIL because the new module and normalizer do not exist.

- [ ] **Step 3: Implement the Domain types and normalizer minimally**

Use these public shapes verbatim:

```ts
export type WordRequestModerationSelection =
    | {
        kind: 'word-request';
        requestId: number;
        selectedThemeIds: number[];
    }
    | {
        kind: 'theme-change';
        wordId: number;
        changes: Array<{ themeId: number; type: 'add' | 'delete' }>;
    };

export type ModerateWordRequestsCommand = {
    selections: WordRequestModerationSelection[];
};

export function normalizeWordRequestModerationCommand(
    command: ModerateWordRequestsCommand,
): Result<ModerateWordRequestsCommand>;
```

Validate JavaScript-safe positive integers with `Number.isSafeInteger`, cap top-level selections at 30, sort word requests by `requestId`, sort theme groups by `wordId`, sort theme IDs numerically, and sort changes by `themeId` then `type`. Do not infer add/delete request type in Domain because only DB owns that fact.

- [ ] **Step 4: Run Domain tests and verify GREEN**

Run the Step 2 command. Expected: PASS with no warnings.

- [ ] **Step 5: Write failing Application service tests**

Use a small fake `WordRequestModerationGateway`. Assert observable results and exact normalized boundary payloads.

```ts
export interface WordRequestModerationGateway {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
}

export type WordRequestModerationResult = {
    processedWordRequestCount: number;
    processedThemeChangeCount: number;
    affectedDocsIds: number[];
};
```

Required behaviors:

- `approve` passes the normalized command to `gateway.approve` and returns its result.
- `reject` passes the normalized command to `gateway.reject` and returns its result.
- Domain validation failure returns before either gateway method runs.
- conflict and infrastructure errors are preserved without rewriting their kind or message.

- [ ] **Step 6: Run Application tests and verify RED**

Run:

```bash
npx jest src/__tests__/modules/word-moderation/application/moderate-word-requests.test.ts --runInBand
```

Expected: FAIL because `ModerateWordRequestsService` and the gateway port do not exist.

- [ ] **Step 7: Implement the Application service and exports minimally**

```ts
export class ModerateWordRequestsService {
    constructor(private readonly gateway: WordRequestModerationGateway) {}

    async approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        const normalized = normalizeWordRequestModerationCommand(command);
        return normalized.ok ? this.gateway.approve(normalized.value) : normalized;
    }

    async reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        const normalized = normalizeWordRequestModerationCommand(command);
        return normalized.ok ? this.gateway.reject(normalized.value) : normalized;
    }
}
```

Follow the repository's actual `Result` discriminant and import conventions if its property name differs from the illustrative `ok` check. Export only consumer contracts from `src/modules/word-moderation/index.ts`; do not export Supabase-specific types.

- [ ] **Step 8: Run both Task 1 test files and verify GREEN**

```bash
npx jest src/__tests__/modules/word-moderation/domain/word-request-moderation.test.ts src/__tests__/modules/word-moderation/application/moderate-word-requests.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/modules/word-moderation src/__tests__/modules/word-moderation/domain/word-request-moderation.test.ts src/__tests__/modules/word-moderation/application/moderate-word-requests.test.ts
git commit -m "feat: add word request moderation contracts"
```

---

### Task 2: Atomic approval and rejection RPCs

**Files:**
- Create: `supabase/tests/database/word-request-moderation.integration.sql`
- Create: `supabase/migrations/20260821130000_admin_word_request_moderation.sql`
- Create: `docs/testing/word-request-moderation-rpc-integration.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: normalized `ModerateWordRequestsCommand.selections` JSON from Task 1 and existing `increment_contribution(uuid, integer)` / `update_last_updates(bigint[])` functions.
- Produces: `public.approve_word_requests(jsonb) -> jsonb`, `public.reject_word_requests(jsonb) -> jsonb`, and `npm run test:word-request-moderation-db`.

- [ ] **Step 1: Write the failing pgTAP behavior and rollback tests**

Create fixtures with isolated UUIDs, non-Hangul sentinel words, explicit letter/theme docs, two admin users, one ordinary user, whole-word add/delete requests, `wait_word_themes`, and selected/unselected `word_themes_wait` rows.

The test must assert literal outcomes for:

- anonymous, missing JWT and ordinary authenticated users are rejected;
- an authenticated `users.role = 'admin'` actor can approve a mixed command;
- add approval inserts one word, connects only selected themes, removes its whole `wait_words` row, writes one approved word log, writes intended docs logs, updates docs, and increments the original requester once;
- delete approval captures old themes, deletes the word and request, writes approved word/docs logs, updates docs, and increments the requester once;
- selected theme add/delete changes apply and their wait rows disappear while unselected rows remain;
- reject removes selected whole-word and theme-change requests, writes rejected logs only for whole-word requests, and does not change words, docs logs or contribution;
- stale request IDs and mismatched theme selections return `WORD_REQUEST_MODERATION_CONFLICT` with no side effects;
- a temporary failing trigger on `logs` rolls back every earlier mutation and returns `WORD_REQUEST_MODERATION_INTERNAL_ERROR`;
- execute privilege is absent for `anon` and present for `authenticated` and `service_role`;
- both public functions expose `search_path = pg_catalog, public, pg_temp`.

Use `select no_plan();` at the end so assertions remain explicit without maintaining a fragile numeric plan count.

- [ ] **Step 2: Add the npm script and run the DB test to verify RED**

Add exactly:

```json
"test:word-request-moderation-db": "supabase test db --local supabase/tests/database/word-request-moderation.integration.sql"
```

Start local Supabase only for this DB task:

```bash
supabase start
npm run test:word-request-moderation-db
```

Expected: FAIL because the RPC functions do not exist. If local bootstrap cannot start, record the exact baseline/bootstrap blocker; do not point the test at a linked remote project.

- [ ] **Step 3: Implement the private authorization helper and public RPC shells**

Use these signatures and security declarations verbatim:

```sql
create or replace function private.assert_word_request_moderation_admin()
returns uuid
language plpgsql
security invoker
set search_path = '';

create or replace function public.approve_word_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp;

create or replace function public.reject_word_requests(p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp;
```

`assert_word_request_moderation_admin` must map missing `auth.uid()` to `WORD_REQUEST_MODERATION_UNAUTHORIZED`, permit only `users.role = 'admin'`, and map every other actor to `WORD_REQUEST_MODERATION_FORBIDDEN`.

- [ ] **Step 4: Implement strict preflight validation and deterministic locking**

Before side effects, validate JSON shape, permitted keys, 1–30 selections, safe positive integer range, uniqueness, nonempty theme changes, and exact queue membership. Lock in this global order:

```text
words(id ASC)
wait_words(id ASC)
word_themes_wait(word_id ASC, theme_id ASC, typez ASC)
word_themes(word_id ASC, theme_id ASC)
```

Lock dependent themes, `wait_word_themes`, docs and users in deterministic ascending key order. A delete request must have an empty `selectedThemeIds`; an add request must have at least one ID and every ID must belong to its `wait_word_themes`. Missing or changed queue state is a conflict, not partial success.

- [ ] **Step 5: Implement approval side effects**

Compute `noin_canuse` only from selected authoritative theme codes using the exact legacy set `0, 10, ..., 530`. Do not reuse a numeric-regex rule.

For each add, delete and selected theme change, reproduce the approved specification. Reuse `increment_contribution` and `update_last_updates`. Account for existing word triggers: do not manually duplicate special trigger-generated docs logs for IDs `201`, `202`, `209..252`; explicitly create only the intended final-letter and theme docs logs not already supplied by triggers.

Return exactly:

```sql
jsonb_build_object(
  'processedWordRequestCount', processed_word_request_count,
  'processedThemeChangeCount', processed_theme_change_count,
  'affectedDocsIds', to_jsonb(affected_docs_ids)
)
```

- [ ] **Step 6: Implement rejection side effects and stable exception mapping**

Whole-word rejection writes a `logs` row using the authoritative word/requester and deletes the `wait_words` row. Theme-change rejection deletes only selected `word_themes_wait` rows. Return an empty `affectedDocsIds` array.

Reraise the five public `P0001` messages unchanged. Convert every unexpected SQLSTATE, trigger or constraint failure to `WORD_REQUEST_MODERATION_INTERNAL_ERROR`. Do not expose raw exception messages to callers.

Revoke default function access and grant only:

```sql
revoke all on function public.approve_word_requests(jsonb) from public, anon;
revoke all on function public.reject_word_requests(jsonb) from public, anon;
grant execute on function public.approve_word_requests(jsonb) to authenticated, service_role;
grant execute on function public.reject_word_requests(jsonb) to authenticated, service_role;
```

- [ ] **Step 7: Run DB tests and verify GREEN**

```bash
npm run test:word-request-moderation-db
```

Expected: all pgTAP assertions pass with no leaked temporary triggers or fixtures.

- [ ] **Step 8: Add a real concurrent processing test if the behavior file cannot prove lock contention**

If the single pgTAP transaction cannot exercise two committed sessions, create `supabase/tests/database/word-request-moderation-concurrency.integration.sql` using the established `dblink` pause-trigger pattern and update the npm script to include both files:

```json
"test:word-request-moderation-db": "supabase test db --local supabase/tests/database/word-request-moderation.integration.sql supabase/tests/database/word-request-moderation-concurrency.integration.sql"
```

Assert one success, one `WORD_REQUEST_MODERATION_CONFLICT`, and exactly one set of logs/contribution. This conditional file is required whenever concurrency is not genuinely exercised by the first file; a sequential replay assertion is not a substitute.

- [ ] **Step 9: Document the local integration procedure**

Create `docs/testing/word-request-moderation-rpc-integration.md` with the exact migration filename, `supabase start`, `npm run test:word-request-moderation-db`, bootstrap limitation, and mandatory `supabase stop`. State explicitly that `--linked` and remote projects must not be used as test targets.

- [ ] **Step 10: Stop local Supabase and commit Task 2**

```bash
supabase stop
git add package.json supabase/migrations/20260821130000_admin_word_request_moderation.sql supabase/tests/database/word-request-moderation.integration.sql supabase/tests/database/word-request-moderation-concurrency.integration.sql docs/testing/word-request-moderation-rpc-integration.md
git commit -m "feat: add atomic word request moderation RPCs"
```

If the concurrency file was unnecessary because real concurrency is covered elsewhere, omit only that nonexistent path from `git add`.

---

### Task 3: Supabase browser gateway and composition

**Files:**
- Create: `src/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.ts`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts`

**Interfaces:**
- Consumes: `WordRequestModerationGateway`, normalized command and result from Task 1; two RPCs from Task 2; browser Supabase client and shared error mapper.
- Produces: `SupabaseWordRequestModerationGateway` and `wordRequestModerationService` on `BrowserWordModerationServices`.

- [ ] **Step 1: Write failing adapter contract tests**

Mock only `browserSupabaseClient.rpc`. For both actions assert the exact external boundary:

```ts
expect(rpc).toHaveBeenCalledWith('approve_word_requests', {
    p_selections: command.selections,
});
```

Use complete fixtures for:

- valid result `{ processedWordRequestCount: 2, processedThemeChangeCount: 1, affectedDocsIds: [12, 18] }`;
- reject result with empty `affectedDocsIds`;
- malformed counts, negative counts, duplicate/non-integer docs IDs and non-object response;
- each public moderation error code;
- an unexpected PostgREST error.

The tests must assert returned `Result` behavior, not merely that the mock exists.

- [ ] **Step 2: Run gateway tests and verify RED**

```bash
npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts --runInBand
```

Expected: FAIL because the gateway does not exist.

- [ ] **Step 3: Implement the response parser and gateway minimally**

```ts
export class SupabaseWordRequestModerationGateway implements WordRequestModerationGateway {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
}
```

Keep the RPC name, `p_selections`, transport response and Supabase errors inside this file. Since generated remote types do not yet contain the local-only RPCs, define the narrow structural transport type here and cast the browser client through `unknown`; do not use `any` and do not edit `database.types.ts`.

Parse the result from `unknown`. Require nonnegative safe integer counts, unique positive safe integer docs IDs, and sort `affectedDocsIds` numerically. Malformed successful data becomes an infrastructure error with a safe message.

- [ ] **Step 4: Map stable RPC errors**

Map:

```text
UNAUTHORIZED -> unauthorized
FORBIDDEN -> forbidden
INVALID_INPUT -> validation
CONFLICT -> conflict
INTERNAL_ERROR and unknown -> infrastructure
```

Reuse the shared Supabase error mapper where it preserves these kinds. Never copy raw error text into the public error message.

- [ ] **Step 5: Extend browser service composition**

Extend the existing singleton interface and factory:

```ts
interface BrowserWordModerationServices {
    wordApprovalService: RunWordApprovalService;
    wordDeletionService: RunWordDeletionService;
    wordRequestModerationService: ModerateWordRequestsService;
}
```

Construct it with `new ModerateWordRequestsService(new SupabaseWordRequestModerationGateway())` and retain the current singleton cache behavior.

- [ ] **Step 6: Run gateway tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/modules/word-moderation/infrastructure/browser src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts
git commit -m "feat: connect word request moderation RPCs"
```

---

### Task 4: React Query moderation hook

**Files:**
- Create: `src/modules/word-moderation/presentation/use-word-request-moderation.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Test: `src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx`

**Interfaces:**
- Consumes: `ModerateWordRequestsService` and browser service composition from earlier tasks.
- Produces: `WordRequestModerationService`, `useWordRequestModeration` and its UI-facing return contract.

- [ ] **Step 1: Write failing hook behavior tests**

Render the real hook with `QueryClientProvider` and an injected fake service. Cover:

- `approve(command)` returns the service result;
- `reject(command)` returns the service result;
- `isPending` is true while a deferred call is unresolved;
- a failed `Result` becomes `error`;
- a later mutation clears the prior error in `onMutate`;
- `clearError()` clears it explicitly;
- an unexpected thrown exception becomes `{ kind: 'infrastructure', message: '요청 단어 처리 중 오류가 발생했습니다.' }`.

- [ ] **Step 2: Run hook tests and verify RED**

```bash
npx jest src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx --runInBand
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook minimally**

Expose exactly:

```ts
export interface WordRequestModerationService {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
}

export function useWordRequestModeration(
    service?: WordRequestModerationService,
): {
    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
};
```

Use one `useMutation` over an internal `{ action: 'approve' | 'reject'; command }` union. Default to `createBrowserWordModerationServices().wordRequestModerationService`. Do not add progress, IndexedDB, resume, cancel, query invalidation or result state.

- [ ] **Step 4: Run hook tests and verify GREEN**

Run the Step 2 command. Expected: PASS with no React state warnings.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/modules/word-moderation/presentation/use-word-request-moderation.ts src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx
git commit -m "feat: add word request moderation hook"
```

---

### Task 5: Admin request UI migration

**Files:**
- Modify: `src/app/admin/request-words/AdminRequestHome.tsx`
- Create: `src/__tests__/admin/request-words/AdminRequestHome.test.tsx`

**Interfaces:**
- Consumes: `useWordRequestModeration`, `ModerateWordRequestsCommand`, existing `requestData`, `ThemeSelectModal`, `ErrorModal` and `refreshFn`.
- Produces: UI behavior with no direct SCM/Supabase mutation knowledge.

- [ ] **Step 1: Write failing component behavior tests against the new hook boundary**

Mock the module entrypoint's `useWordRequestModeration`, not Supabase or SCM. Use Testing Library and `userEvent` to cover these observable behaviors:

- clicking approve with no selection opens an ErrorModal and does not call the action;
- approving an add request sends `{ kind: 'word-request', requestId, selectedThemeIds }` and on success clears the row selection then calls `refreshFn` once;
- approving a theme-change row sends only selected changes and derives each `type` from authoritative `request.wait_themes`;
- rejecting a mixed selection sends the same identifier-only command to `reject`;
- validation/conflict/infrastructure failure preserves selection, skips refresh, and renders sanitized Korean copy;
- while `isPending` is true both `선택 승인` and `선택 반려` buttons are disabled and a second click cannot submit;
- a successful result followed by a rejected `refreshFn` does not replay the mutation and surfaces a safe refresh error Modal.

Use this safe Modal adapter shape:

```ts
const createErrorMessage = (name: string, message: string): ErrorMessage => ({
    ErrName: name,
    ErrMessage: message,
    ErrStackRace: null,
    inputValue: null,
});
```

Expected public messages:

```text
validation: ApplicationError.message
conflict: 요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.
unauthorized: 로그인이 필요합니다.
forbidden: 관리자 권한이 필요합니다.
infrastructure: 요청 단어 처리 중 오류가 발생했습니다.
```

- [ ] **Step 2: Run component tests and verify RED**

```bash
npx jest src/__tests__/admin/request-words/AdminRequestHome.test.tsx --runInBand
```

Expected: FAIL because the component still orchestrates SCM mutations and does not use the hook.

- [ ] **Step 3: Replace approval orchestration with identifier-only command creation**

For each selected request:

```ts
if (request.request_type === 'theme_change') {
    return {
        kind: 'theme-change',
        wordId: request.word_id,
        changes: (request.wait_themes ?? [])
            .filter((theme) => selectedThemeIds.has(theme.theme_id))
            .map((theme) => ({ themeId: theme.theme_id, type: theme.typez })),
    };
}

return {
    kind: 'word-request',
    requestId: request.id,
    selectedThemeIds: Array.from(selectedThemeIds),
};
```

Narrow `word_id` and `typez` before constructing the command. Missing or empty selections must reach Domain validation and preserve UI state; do not silently skip them.

Remove `user`, `PostgrestError`, `isNoin`, `addWordQueryType`, `SCM`, the redundant `allThemes` state/effect, `makeError`, query-array construction and all sequential DB calls.

- [ ] **Step 4: Replace rejection orchestration and error presentation**

Build the same identifier command and call `reject`. Call `clearError` before client-side empty-selection Modal handling so stale hook errors do not overwrite the current message.

On `Result` failure, map only the public `ApplicationError` to safe Modal fields. On success, clear `selectedRequests`, `selectedThemes`, and `allSelected`, then await `refreshFn()`. Catch refresh failure separately and show a safe message without resubmitting.

- [ ] **Step 5: Disable actions while pending and preserve existing selection UX**

Set `disabled={isPending}` on both action buttons. Keep tab/page selection reset and ThemeSelectModal behavior unchanged. Do not change layout, pagination, filtering or request display.

- [ ] **Step 6: Run component tests and verify GREEN**

Run the Step 2 command. Expected: PASS with no raw error output or React warnings.

- [ ] **Step 7: Run the focused frontend suite**

```bash
npx jest src/__tests__/modules/word-moderation src/__tests__/admin/request-words --runInBand
```

Expected: PASS.

- [ ] **Step 8: Verify the presentation boundary outside Jest**

```bash
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" src/app/admin/request-words/AdminRequestHome.tsx
```

Expected: no output. `AdminWrapper.tsx` and `ThemeSelectModal.tsx` are intentionally outside this assertion.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/app/admin/request-words/AdminRequestHome.tsx src/__tests__/admin/request-words/AdminRequestHome.test.tsx
git commit -m "refactor: migrate admin word request moderation"
```

---

### Task 6: Documentation and complete verification

**Files:**
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`
- Verify: all files created or modified by Tasks 1–5

**Interfaces:**
- Consumes: completed vertical slice and verified test commands.
- Produces: truthful roadmap status and final verification evidence.

- [ ] **Step 1: Update roadmap status without overstating Phase 1**

Mark `관리자 요청 단어/개별 승인` as `부분 완료`. Record that `admin/request-words` mutation has moved to atomic approval/rejection RPCs while `TableWorkFunc.tsx` and `admin/request-docs` remain. Update `당장 처리할 작업` so the next functional action is `TableWorkFunc.tsx` approval/deletion characterization and design. Preserve Phase 0A/0B notes.

- [ ] **Step 2: Run lint and TypeScript checks**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both exit 0. If a failure is pre-existing, capture the exact file and diagnostic; do not edit unrelated code.

- [ ] **Step 3: Run focused Jest tests**

```bash
npx jest src/__tests__/modules/word-moderation src/__tests__/admin/request-words --runInBand
```

Expected: all tests pass with no warnings.

- [ ] **Step 4: Run the real DB integration tests**

```bash
supabase start
npm run test:word-request-moderation-db
supabase stop
```

Expected: all behavior, rollback, privilege and concurrency assertions pass. Always execute `supabase stop` after a failed test command as a separate cleanup step.

- [ ] **Step 5: Check formatting and architecture boundary**

```bash
git diff --check
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" src/app/admin/request-words/AdminRequestHome.tsx
```

Expected: `git diff --check` exits 0 and the `rg` command has no matches.

- [ ] **Step 6: Commit Task 6**

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md docs/superpowers/specs/2026-08-21-admin-word-request-moderation-design.md docs/superpowers/plans/2026-08-21-admin-word-request-moderation.md
git commit -m "docs: record request moderation migration"
```

Record all verification commands and exact outcomes in the SDD task report and ledger before final whole-branch review.
