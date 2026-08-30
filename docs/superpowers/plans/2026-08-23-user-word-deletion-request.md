# User Word Deletion Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `words-docs/[id]`의 사용자 단어 삭제 요청과 본인 요청 취소를 `SCM`에서 분리해 `word-requests` Application 계약과 원자적 Supabase RPC로 이전한다.

**Architecture:** 새 `src/modules/word-requests` 모듈이 입력 정규화, use case, 좁은 gateway port, Supabase RPC adapter, React Query presentation hook을 소유한다. UI는 단어만 전달하며 RPC가 `auth.uid()`와 등록 단어 ID를 결정하고, 기존 화면 action hook은 새 presentation API를 완료·오류 Modal 흐름에 연결한다.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, TanStack React Query 5, Supabase/PostgreSQL PL/pgSQL, Jest 30, Testing Library, pgTAP, dblink

**Spec:** `docs/superpowers/specs/2026-08-23-user-word-deletion-request-design.md`

## Global Constraints

- 이번 범위는 `words-docs/[id]`의 삭제 요청 생성과 pending 요청 취소만 포함한다.
- `word/add`, `word/adds`, `word/search`와 기존 RLS 정책 축소는 변경하지 않는다.
- UI와 Application은 사용자 UUID, DB ID, table, column, RPC payload를 알지 않는다.
- RPC가 `auth.uid()`로 요청자를 결정하고 `wait_words.word` unique constraint가 동시 중복 요청을 최종 차단한다.
- 기존 완료 Modal과 데이터 새로고침 동작을 유지하며 오류에는 안전한 `ApplicationError` 메시지만 노출한다.
- 생성된 `src/app/types/database.types.ts`는 수정하지 않는다.
- 새 production 함수는 실패하는 테스트를 먼저 확인한 뒤 구현한다.
- 코드 변경 완료 후 `npm run lint`, `npx tsc --noEmit`, 관련 Jest를 실행한다.

---

### Task 1: Domain 및 Application 계약

**Files:**
- Create: `src/modules/word-requests/domain/user-word-request.ts`
- Create: `src/modules/word-requests/application/user-word-request-types.ts`
- Create: `src/modules/word-requests/application/user-word-request-ports.ts`
- Create: `src/modules/word-requests/application/manage-user-word-requests.ts`
- Test: `src/__tests__/modules/word-requests/domain/user-word-request.test.ts`
- Test: `src/__tests__/modules/word-requests/application/manage-user-word-requests.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ApplicationError` from `src/shared/application`
- Produces: `normalizeUserWordRequestCommand`, `UserWordRequestGateway`, `ManageUserWordRequestsService`, `UserWordRequestCommand`, `UserWordRequestResult`

- [ ] **Step 1: 입력 정규화 실패 테스트 작성**

```ts
import { normalizeUserWordRequestCommand } from '@/src/modules/word-requests/domain/user-word-request';

describe('user word request domain', () => {
    it('trims surrounding whitespace from a word', () => {
        expect(normalizeUserWordRequestCommand({ word: '  나비  ' })).toEqual({
            ok: true,
            value: { word: '나비' },
        });
    });

    it.each(['', '   '])('rejects an empty normalized word', (word) => {
        expect(normalizeUserWordRequestCommand({ word })).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
    });

    it('rejects a non-string word at the runtime boundary', () => {
        expect(normalizeUserWordRequestCommand({ word: 7 } as never)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
    });
});
```

- [ ] **Step 2: Domain 테스트가 올바른 이유로 실패하는지 확인**

Run:

```bash
npx jest src/__tests__/modules/word-requests/domain/user-word-request.test.ts --runInBand
```

Expected: `Cannot find module '@/src/modules/word-requests/domain/user-word-request'`로 FAIL.

- [ ] **Step 3: 최소 Domain 타입과 정규화 구현**

```ts
// application/user-word-request-types.ts
export type UserWordRequestCommand = { word: string };
export type UserWordRequestResult = {
    requestId: number;
    word: string;
    requestType: 'add' | 'delete';
};

// domain/user-word-request.ts
import { err, ok, type Result } from '@/src/shared/application/result';
import type { UserWordRequestCommand } from '../application/user-word-request-types';

export function normalizeUserWordRequestCommand(
    command: UserWordRequestCommand,
): Result<UserWordRequestCommand> {
    const rawWord: unknown = (command as { word?: unknown } | null)?.word;
    if (typeof rawWord !== 'string' || rawWord.trim().length === 0) {
        return err({ kind: 'validation', field: 'word', message: '단어를 입력해 주세요.' });
    }
    return ok({ word: rawWord.trim() });
}
```

- [ ] **Step 4: Domain 테스트 통과 확인**

Run: `npx jest src/__tests__/modules/word-requests/domain/user-word-request.test.ts --runInBand`

Expected: 4 tests PASS.

- [ ] **Step 5: Application service 실패 테스트 작성**

```ts
class FakeUserWordRequestGateway implements UserWordRequestGateway {
    requestDeletionResult: Result<UserWordRequestResult> = ok({
        requestId: 11, word: '나비', requestType: 'delete',
    });
    cancelResult: Result<UserWordRequestResult> = ok({
        requestId: 12, word: '가방', requestType: 'add',
    });
    requested: UserWordRequestCommand[] = [];
    cancelled: UserWordRequestCommand[] = [];

    async requestDeletion(command: UserWordRequestCommand) {
        this.requested.push(command);
        return this.requestDeletionResult;
    }
    async cancel(command: UserWordRequestCommand) {
        this.cancelled.push(command);
        return this.cancelResult;
    }
}

it('passes normalized deletion and cancellation commands to the gateway', async () => {
    const gateway = new FakeUserWordRequestGateway();
    const service = new ManageUserWordRequestsService(gateway);
    await service.requestDeletion({ word: ' 나비 ' });
    await service.cancel({ word: ' 가방 ' });
    expect(gateway.requested).toEqual([{ word: '나비' }]);
    expect(gateway.cancelled).toEqual([{ word: '가방' }]);
});

it('does not call the gateway when validation fails', async () => {
    const gateway = new FakeUserWordRequestGateway();
    const service = new ManageUserWordRequestsService(gateway);
    await expect(service.requestDeletion({ word: ' ' })).resolves.toMatchObject({
        ok: false,
        error: { kind: 'validation' },
    });
    expect(gateway.requested).toEqual([]);
});
```

- [ ] **Step 6: Application 테스트 실패 확인**

Run: `npx jest src/__tests__/modules/word-requests/application/manage-user-word-requests.test.ts --runInBand`

Expected: service와 port module이 없어 FAIL.

- [ ] **Step 7: Port와 service 최소 구현**

```ts
// application/user-word-request-ports.ts
export interface UserWordRequestGateway {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
}

// application/manage-user-word-requests.ts
export class ManageUserWordRequestsService {
    constructor(private readonly gateway: UserWordRequestGateway) {}

    async requestDeletion(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.requestDeletion(normalized.value) : normalized;
    }

    async cancel(command: UserWordRequestCommand) {
        const normalized = normalizeUserWordRequestCommand(command);
        return normalized.ok ? this.gateway.cancel(normalized.value) : normalized;
    }
}
```

- [ ] **Step 8: Task 1 테스트와 타입 검사**

Run:

```bash
npx jest src/__tests__/modules/word-requests/domain/user-word-request.test.ts src/__tests__/modules/word-requests/application/manage-user-word-requests.test.ts --runInBand
npx tsc --noEmit
```

Expected: 관련 테스트와 typecheck PASS.

- [ ] **Step 9: Task 1 커밋**

```bash
git add src/modules/word-requests/domain/user-word-request.ts src/modules/word-requests/application src/__tests__/modules/word-requests/domain src/__tests__/modules/word-requests/application
git commit -m "feat: add user word request application contract"
```

---

### Task 2: Supabase gateway, composition root, presentation hook

**Files:**
- Create: `src/modules/word-requests/infrastructure/browser/supabase-user-word-request-gateway.ts`
- Create: `src/modules/word-requests/infrastructure/browser/browser-word-request-services.ts`
- Create: `src/modules/word-requests/presentation/use-user-word-requests.ts`
- Create: `src/modules/word-requests/index.ts`
- Test: `src/__tests__/modules/word-requests/infrastructure/browser/supabase-user-word-request-gateway.test.ts`
- Test: `src/__tests__/modules/word-requests/infrastructure/browser/browser-word-request-services.test.ts`
- Test: `src/__tests__/modules/word-requests/presentation/use-user-word-requests.test.tsx`

**Interfaces:**
- Consumes: Task 1 `UserWordRequestGateway`, `ManageUserWordRequestsService`, command/result types
- Produces: `SupabaseUserWordRequestGateway`, `createBrowserWordRequestServices`, `useUserWordRequests`, public module exports

- [ ] **Step 1: Gateway contract 실패 테스트 작성**

```ts
const success = { requestId: 11, word: '나비', requestType: 'delete' };

it('requests deletion through request_word_deletion with only the word', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: success, error: null });
    const gateway = new SupabaseUserWordRequestGateway({ rpc });
    await expect(gateway.requestDeletion({ word: '나비' })).resolves.toEqual(ok(success));
    expect(rpc).toHaveBeenCalledWith('request_word_deletion', { p_word: '나비' });
});

it('cancels through cancel_word_request with only the word', async () => {
    const rpc = jest.fn().mockResolvedValue({
        data: { requestId: 12, word: '가방', requestType: 'add' }, error: null,
    });
    const gateway = new SupabaseUserWordRequestGateway({ rpc });
    await expect(gateway.cancel({ word: '가방' })).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith('cancel_word_request', { p_word: '가방' });
});
```

Add table-driven tests for malformed object, unsafe/non-positive `requestId`, mismatched word,
invalid `requestType`, thrown RPC, unknown DB errors, and all six public error codes. Each malformed
response must return `{ ok: false, error: { kind: 'infrastructure' } }`; public codes must map to
the kinds approved in the spec without exposing the raw DB message.

- [ ] **Step 2: Gateway 테스트 실패 확인**

Run: `npx jest src/__tests__/modules/word-requests/infrastructure/browser/supabase-user-word-request-gateway.test.ts --runInBand`

Expected: gateway module이 없어 FAIL.

- [ ] **Step 3: Gateway 최소 구현**

Implement an injectable RPC client with signature:

```ts
interface UserWordRequestRpcClient {
    rpc(functionName: string, args: Record<string, unknown>): Promise<{
        data: unknown;
        error: { code?: string | null; message: string } | null;
    }>;
}
```

`parseUserWordRequestResult` must accept only an object with a positive safe integer
`requestId`, exact command `word`, and `requestType` equal to `add` or `delete`. Map:

```ts
const errorKinds = {
    WORD_REQUEST_UNAUTHORIZED: 'unauthorized',
    WORD_REQUEST_INVALID_INPUT: 'validation',
    WORD_REQUEST_NOT_FOUND: 'not-found',
    WORD_REQUEST_CONFLICT: 'conflict',
    WORD_REQUEST_FORBIDDEN: 'forbidden',
    WORD_REQUEST_INTERNAL_ERROR: 'infrastructure',
} as const;
```

Use `browserSupabaseClient` only as the default injected client. Catch thrown calls and sanitize
unknown responses/errors as infrastructure failures.

- [ ] **Step 4: Gateway 테스트 통과 확인**

Run: `npx jest src/__tests__/modules/word-requests/infrastructure/browser/supabase-user-word-request-gateway.test.ts --runInBand`

Expected: all gateway contract tests PASS.

- [ ] **Step 5: Presentation hook 실패 테스트 작성**

Use a real `QueryClientProvider` and an injected fake service. Verify observable results:

```ts
it('returns the deletion result and exposes pending while the service is unresolved', async () => {
    const deferred = createDeferred<Result<UserWordRequestResult>>();
    const service = { requestDeletion: jest.fn(() => deferred.promise), cancel: jest.fn() };
    const { result } = renderUserWordRequests(service);
    let promise!: Promise<Result<UserWordRequestResult>>;
    act(() => { promise = result.current.requestDeletion({ word: '나비' }); });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    deferred.resolve(ok({ requestId: 11, word: '나비', requestType: 'delete' }));
    await expect(promise).resolves.toMatchObject({ ok: true });
    await waitFor(() => expect(result.current.isPending).toBe(false));
});
```

Also verify cancel dispatch, failed `Result` stored in `error`, `clearError`, and thrown service
converted to a safe infrastructure `Result`.

- [ ] **Step 6: Presentation 테스트 실패 확인**

Run: `npx jest src/__tests__/modules/word-requests/presentation/use-user-word-requests.test.tsx --runInBand`

Expected: hook module이 없어 FAIL.

- [ ] **Step 7: Composition root, hook, public exports 구현**

The hook API is:

```ts
export function useUserWordRequests(service?: UserWordRequestService): {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
}
```

Initialize the resolved service once with `useState(() => service ?? createBrowserWordRequestServices().userWordRequestService)`.
Use one `useMutation` discriminated by `action: 'request-deletion' | 'cancel'` and convert thrown
service calls to a safe infrastructure error.

- [ ] **Step 8: Task 2 테스트와 타입 검사**

Run:

```bash
npx jest src/__tests__/modules/word-requests/infrastructure/browser src/__tests__/modules/word-requests/presentation --runInBand
npx tsc --noEmit
```

Expected: Task 2 tests and typecheck PASS.

- [ ] **Step 9: Task 2 커밋**

```bash
git add src/modules/word-requests src/__tests__/modules/word-requests
git commit -m "feat: add browser user word request services"
```

---

### Task 3: 원자적 사용자 요청 RPC와 실제 DB 테스트

**Files:**
- Create: `supabase/tests/database/user-word-request.integration.sql`
- Create: `supabase/tests/database/user-word-request-concurrency.integration.sql`
- Create: `supabase/migrations/20260823120000_user_word_requests.sql`
- Modify: `package.json`
- Create: `docs/testing/user-word-request-rpc-integration.md`

**Interfaces:**
- Consumes: existing `public.words`, `public.wait_words`, `auth.uid()`, request enums and unique constraint
- Produces: `public.request_word_deletion(text) -> jsonb`, `public.cancel_word_request(text) -> jsonb`, `npm run test:user-word-request-db`

- [ ] **Step 1: Behavior pgTAP 테스트 작성**

Create isolated auth/public users and words inside a transaction. Use `set local role authenticated`
and JWT claim helpers matching existing database tests. Assert:

```sql
select throws_ok(
    $$select public.request_word_deletion('user-request-word')$$,
    'P0001', 'WORD_REQUEST_UNAUTHORIZED',
    'an unauthenticated deletion request is rejected'
);

select is(
    public.request_word_deletion(' user-request-word '),
    jsonb_build_object(
        'requestId', (select id from public.wait_words where word = 'user-request-word'),
        'word', 'user-request-word',
        'requestType', 'delete'
    ),
    'deletion request returns the public contract'
);

select is(
    (select requested_by from public.wait_words where word = 'user-request-word'),
    '45000000-0000-4000-8000-000000000001'::uuid,
    'the RPC stores auth.uid as the requester'
);
```

Add assertions for blank input, unknown registered word, duplicate request conflict, cancelling an
own pending add request, cancelling an own pending delete request, inability to cancel another
user's request, rollback after an injected trigger failure, function security mode/search path, and
execute privileges (`authenticated` true; `anon`/`public` false).

- [ ] **Step 2: Concurrency pgTAP 테스트 작성**

Use `dblink` sessions authenticated as two users. Hold the first insert transaction with a
test-only trigger/advisory lock, start the second request while the first is blocked, then release.
Assert exactly one result contains the success DTO, exactly one contains
`WORD_REQUEST_CONFLICT`, and exactly one `wait_words` row exists with the winning session's
`requested_by`. Clean up all test functions, triggers, rows, and dblink connections.

- [ ] **Step 3: DB 테스트가 RPC 부재로 실패하는지 확인**

Run only against the disposable local stack:

```bash
supabase start
supabase migration up --local
supabase test db --local supabase/tests/database/user-word-request.integration.sql supabase/tests/database/user-word-request-concurrency.integration.sql
```

Expected: `public.request_word_deletion(text)` / `public.cancel_word_request(text)`가 없어 FAIL.

- [ ] **Step 4: Forward migration 최소 구현**

Implement both functions with this fixed security envelope:

```sql
create or replace function public.request_word_deletion(p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    normalized_word text := pg_catalog.btrim(p_word);
    word_row public.words%rowtype;
    request_row public.wait_words%rowtype;
begin
    -- explicit auth/input checks
    -- select registered word for update
    -- insert requested_by = actor and request_type = 'delete'
    -- return requestId/word/requestType JSON
exception
    when unique_violation then
        raise exception using errcode = 'P0001', message = 'WORD_REQUEST_CONFLICT';
end;
$function$;
```

`cancel_word_request` must select only `requested_by = actor` and `status = 'pending'` for update,
delete by selected ID, and return the deleted row's request type. Revoke default execution before
granting only authenticated:

```sql
revoke all on function public.request_word_deletion(text) from public, anon;
revoke all on function public.cancel_word_request(text) from public, anon;
grant execute on function public.request_word_deletion(text) to authenticated;
grant execute on function public.cancel_word_request(text) to authenticated;
```

- [ ] **Step 5: DB 테스트 통과 확인**

Run:

```bash
supabase migration up --local
supabase test db --local supabase/tests/database/user-word-request.integration.sql supabase/tests/database/user-word-request-concurrency.integration.sql
```

Expected: behavior and deterministic concurrency assertions PASS.

- [ ] **Step 6: Script와 운영 문서 추가**

Add to `package.json`:

```json
"test:user-word-request-db": "supabase test db --local supabase/tests/database/user-word-request.integration.sql supabase/tests/database/user-word-request-concurrency.integration.sql"
```

Document exactly:

```bash
supabase start
supabase migration up --local
npm run test:user-word-request-db
supabase stop
```

The document must state that `--linked`, project references, and remote Supabase projects are
forbidden for these tests.

- [ ] **Step 7: Task 3 검사와 커밋**

Run: `git diff --check`

Then:

```bash
git add supabase/migrations/20260823120000_user_word_requests.sql supabase/tests/database/user-word-request.integration.sql supabase/tests/database/user-word-request-concurrency.integration.sql package.json docs/testing/user-word-request-rpc-integration.md
git commit -m "feat: add atomic user word request RPCs"
```

---

### Task 4: `words-docs/[id]` 화면 연결

**Files:**
- Modify: `src/app/words-docs/[id]/use-user-word-request-actions.ts`
- Modify: `src/app/words-docs/[id]/Table.tsx`
- Modify: `src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx`
- Modify: `src/__tests__/words-docs/id/Table.test.tsx`

**Interfaces:**
- Consumes: Task 2 `useUserWordRequests`, `ApplicationError`
- Produces: camelCase `requestDelete`, `cancelAddRequest`, `cancelDeleteRequest` UI actions without SCM/user dependencies

- [ ] **Step 1: 화면 action hook 테스트를 새 계약으로 변경하고 실패 확인**

Replace the SCM mock with an injected `UserWordRequestService` fake. Assert real hook outcomes:

```ts
it('requests deletion through the application service and completes only after success', async () => {
    const events: string[] = [];
    const service = createService({
        requestDeletion: async () => {
            events.push('request-deletion');
            return ok({ requestId: 11, word: '나비', requestType: 'delete' });
        },
    });
    const { result } = renderActions({ service, events });
    await act(async () => result.current.requestDelete('나비'));
    expect(events).toEqual(['processing:true', 'request-deletion', 'processing:false', 'complete']);
});
```

Add cases for `cancelAddRequest`, `cancelDeleteRequest`, existing processing guard, service
`isPending` guard, failed `Result`, and thrown service. For every failure assert
`processing:false`, one safe `makeError(ApplicationError)`, and no `completeWork`.

Run:

```bash
npx jest src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx --runInBand
```

Expected: old SCM-based implementation/API makes the new tests FAIL.

- [ ] **Step 2: action hook를 새 presentation API로 최소 이전**

Change options to:

```ts
type UseUserWordRequestActionsOptions = {
    makeError(error: ApplicationError): void;
    setIsProcessing: Dispatch<SetStateAction<boolean>>;
    completeWork(): void;
    isProcessing: boolean;
    service?: UserWordRequestService;
};
```

Remove `SCM`, `PostgrestError`, `RootState`, and `user`. Call `useUserWordRequests(service)` and
use a shared async runner that sets processing true, awaits one mutation, calls `makeError` on a
failed `Result`, calls `completeWork` only on success, and resets processing in `finally`.

- [ ] **Step 3: `Table.tsx` 호출부와 오류 Modal 연결 수정**

Remove `user` from hook options and consume camelCase action names. `makeError` uses:

```ts
const makeError = (error: ApplicationError) => {
    closeWork();
    seterrorModalView({
        ErrName: 'UserWordRequestError',
        ErrMessage: error.message,
        ErrStackRace: error.code,
        inputValue: null,
    });
};
```

Keep existing WorkModal prop names and map them to the renamed functions at the call site.

- [ ] **Step 4: UI 테스트 통과 및 SCM 제거 확인**

Run:

```bash
npx jest src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx src/__tests__/words-docs/id/Table.test.tsx --runInBand
git grep -n -E "SCM|@supabase/supabase-js|RootState" -- "src/app/words-docs/[id]/use-user-word-request-actions.ts"
npx tsc --noEmit
```

Expected: Jest/typecheck PASS and grep has no matches.

- [ ] **Step 5: Task 4 커밋**

```bash
git add src/app/words-docs/[id]/use-user-word-request-actions.ts src/app/words-docs/[id]/Table.tsx src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx src/__tests__/words-docs/id/Table.test.tsx
git commit -m "refactor: migrate docs user word request actions"
```

---

### Task 5: 로드맵 갱신과 전체 검증

**Files:**
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: Tasks 1–4의 완료 상태와 검증 결과
- Produces: Phase 2 부분 완료 기록과 다음 세로 슬라이스 지정

- [ ] **Step 1: 로드맵 상태 갱신**

Record that `words-docs/[id]`의 `RequestDelete`, `CancelAddRequest`,
`CancelDeleteRequest` is complete, `user word requests` is `부분 완료`, and the next Phase 2
slice is `word/search/[query]/WordInfo.tsx` request/cancel behavior. Keep `word/add` and
`word/adds` listed as remaining.

- [ ] **Step 2: 관련 Jest 전체 실행**

Run:

```bash
npx jest src/__tests__/modules/word-requests src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx src/__tests__/words-docs/id/Table.test.tsx --runInBand
```

Expected: all selected suites PASS with no warnings.

- [ ] **Step 3: 필수 정적 검증**

Run:

```bash
npm run lint
npx tsc --noEmit
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: 전체 Jest 회귀 검사**

Run:

```bash
npm run test -- --runInBand
```

Expected: all suites PASS. If a pre-existing unrelated failure appears, preserve the output and
report it without editing unrelated tests.

- [ ] **Step 5: 실제 DB 최종 검사**

If the local Supabase Docker stack is available, run:

```bash
npm run test:user-word-request-db
```

Expected: behavior and concurrency pgTAP suites PASS. If the local stack is unavailable, record
the exact startup/tooling failure and do not use any linked or remote project.

- [ ] **Step 6: 상태·diff 최종 검토**

Run:

```bash
git status --short
git diff --stat HEAD~4..HEAD
git log --oneline -6
```

Confirm no unrelated files changed, no generated DB types were edited, and every implementation
commit matches the planned scope.

- [ ] **Step 7: 로드맵 커밋**

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "docs: record user word request migration progress"
```
