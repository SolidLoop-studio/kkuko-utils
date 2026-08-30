# 재개 가능한 단어 승인 배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 단어 대량 승인을 브라우저에서 Supabase Database RPC로 직접 실행하되, 각 배치는 원자적이고 전체 작업은 새로고침·네트워크 실패 후 안전하게 재개할 수 있게 한다.

**Architecture:** `word-moderation` 세로 슬라이스가 입력 정규화, 결정적 hash, operation orchestration과 진행률을 소유한다. 브라우저 adapter는 Supabase RPC와 IndexedDB만 담당하고, PostgreSQL `SECURITY DEFINER` RPC가 `auth.uid()`와 `users.role`을 재검증한 뒤 한 배치의 모든 side effect를 하나의 transaction으로 처리한다. SQL migration 전달 후 사용자의 프로덕션 적용 확인 전까지 원격 타입 생성과 RPC adapter/UI 연결을 중단한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, React Query 5, Supabase JS/SSR 2, PostgreSQL PL/pgSQL, IndexedDB (`idb`), Jest 30, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-20-ddd-lite-data-access-refactoring-design.md`

## Global Constraints

- 대량 승인 경로에 Next.js Route Handler, Server Action, Edge Function을 추가하지 않는다.
- 브라우저는 Supabase Database RPC를 직접 호출하며 service-role key를 사용하지 않는다.
- Database Function은 `auth.uid()`와 `public.users.role = 'admin'`을 매 호출마다 검사한다.
- 하나의 RPC 호출은 최대 50개 항목의 원자적 배치 하나만 처리한다.
- `operationId + batchIndex + payloadHash`로 배치 재호출을 멱등하게 처리한다.
- DB operation/batch 기록이 완료 상태의 진실의 원천이고 IndexedDB는 같은 브라우저의 payload 저장소다.
- Domain/Application은 Supabase, React, Next.js와 생성된 `Database` 타입을 import하지 않는다.
- `src/app/types/database.types.ts`를 직접 편집하지 않는다.
- SQL은 `supabase/migrations/20260820000000_add_word_approval_batch.sql`로 별도 커밋하고 Codex가 remote migration 또는 `supabase db push`를 실행하지 않는다.
- 사용자가 프로덕션 적용 완료를 명시하기 전에는 `npm run gen-type`, 실제 RPC adapter 연동, 프로덕션 호출 검증을 실행하지 않는다.
- 기존 `AddWordsHome`의 공개 UI와 승인 결과를 유지하되 오류는 프로젝트 `ErrorModal`로 표시한다.
- 기존 다른 화면이 사용하는 SCM 메서드와 테이블 권한은 이번 슬라이스에서 제거하지 않는다.

---

## 구현 구간 A: 프로덕션 DB 배포 전

### Task 0: 현재 관리자 승인 결과 Characterization Test

**Files:**
- Create: `src/__tests__/admin/add-words/AddWordsHome.characterization.test.tsx`

**Interfaces:**
- Exercises: 현재 `AddWordsHome`의 JSON 업로드부터 완료 UI까지의 실제 orchestration
- Records: 신규 단어, 기존 단어 주제 변경, 로그, 기여도, 대기 요청 삭제 boundary payload
- Changes no production code

- [ ] **Step 1: 현재 신규 단어 승인 결과를 고정하는 테스트 작성**

Redux에는 admin UUID를 제공하고 외부 경계인 `SCM`만 완전한 Supabase 응답 shape로 대체한다. `{ 나비: ['10', '20'] }` 파일과 `wait_words` 요청자를 입력해 처리 완료 후 다음 boundary 결과를 검증한다.

```ts
expect(addWords).toHaveBeenCalledWith([
    { word: '나비', k_canuse: true, noin_canuse: true, added_by: requesterId },
]);
expect(addWordLog).toHaveBeenCalledWith([
    expect.objectContaining({
        word: '나비',
        processed_by: adminId,
        make_by: requesterId,
        r_type: 'add',
        state: 'approved',
    }),
]);
expect(updateContribution).toHaveBeenCalledWith({ userId: requesterId, amount: 1 });
expect(deleteWaitWords).toHaveBeenCalledWith([waitWordId]);
expect(screen.getByText('처리가 완료되었습니다!')).toBeInTheDocument();
```

- [ ] **Step 2: 기존 단어의 canonical theme 변경 결과를 고정하는 테스트 작성**

기존 themes가 `10, 30`, 업로드 themes가 `10, 20`인 fixture로 추가 `20`, 삭제 `30`, theme docs log 두 건, 영향 docs의 last update와 처리된 `word_themes_wait` 정리를 검증한다.

- [ ] **Step 3: 현재 코드에서 characterization test가 통과하는지 확인**

Run: `npx jest src/__tests__/admin/add-words/AddWordsHome.characterization.test.tsx --runInBand`

Expected: PASS. 실패하면 fixture가 실제 Supabase response shape를 완전히 반영하는지 먼저 수정하고, 현재 production 동작은 바꾸지 않는다.

- [ ] **Step 4: 안전망 테스트 커밋**

```bash
git add src/__tests__/admin/add-words/AddWordsHome.characterization.test.tsx
git commit -m "test: characterize bulk word approval"
```

### Task 1: 공통 Application 결과와 Browser Supabase 경계

**Files:**
- Create: `src/shared/application/application-error.ts`
- Create: `src/shared/application/result.ts`
- Create: `src/shared/infrastructure/supabase/browser-client.ts`
- Create: `src/shared/infrastructure/supabase/server-client.ts`
- Create: `src/shared/infrastructure/supabase/service-client.ts`
- Create: `src/shared/infrastructure/supabase/map-supabase-error.ts`
- Create: `src/__tests__/shared/infrastructure/supabase/map-supabase-error.test.ts`
- Create: `src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts`
- Modify: `src/app/lib/supabaseClient.ts`
- Modify: `src/app/lib/supabaseServer.ts`
- Modify: `src/app/lib/supabase/supabaseServerManager.ts`
- Modify: `eslint.config.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `ApplicationError`, `Result<T>`, `ok<T>()`, `err<T>()`
- Produces: `browserSupabaseClient: SupabaseClient<Database>`
- Produces: request-scoped `createServerSupabaseClient()` and server-only `createServiceSupabaseClient()`
- Produces: `mapSupabaseError(error: SupabaseErrorLike): ApplicationError`
- Preserves: legacy `supabase`와 `SCM` exports for 아직 이전하지 않은 화면

- [ ] **Step 1: Supabase 오류가 안정적인 Application 오류로 변환되는 실패 테스트 작성**

```ts
import { mapSupabaseError } from '@/src/shared/infrastructure/supabase/map-supabase-error';

describe('mapSupabaseError', () => {
    test.each([
        ['WORD_APPROVAL_UNAUTHORIZED', 'unauthorized'],
        ['WORD_APPROVAL_FORBIDDEN', 'forbidden'],
        ['WORD_APPROVAL_NOT_FOUND', 'not-found'],
        ['WORD_APPROVAL_CONFLICT', 'conflict'],
        ['WORD_APPROVAL_INVALID_INPUT', 'validation'],
    ] as const)('%s 오류를 %s로 매핑한다', (message, kind) => {
        expect(mapSupabaseError({ code: 'P0001', message })).toMatchObject({ kind });
    });

    it('알 수 없는 DB 오류의 내부 message를 UI message로 노출하지 않는다', () => {
        expect(mapSupabaseError({ code: 'XX000', message: 'relation secret failed' })).toEqual({
            kind: 'infrastructure',
            message: '데이터 처리 중 오류가 발생했습니다.',
            code: 'XX000',
        });
    });
});
```

`supabase-clients.test.ts`에는 Supabase 생성 함수를 대체해 browser factory가 module당 한 번만 만들어지고, server client는 호출마다 새 instance를 반환하며, service factory가 `SUPABASE_SERVICE_KEY`를 사용한다는 테스트를 함께 작성한다.

- [ ] **Step 2: 테스트가 module-not-found로 실패하는지 확인**

Run: `npx jest src/__tests__/shared/infrastructure/supabase/map-supabase-error.test.ts src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts --runInBand`

Expected: FAIL because the shared Supabase boundary modules do not exist.

- [ ] **Step 3: Result와 오류 mapper를 최소 구현**

```ts
export type ApplicationError =
    | { kind: 'validation'; message: string; field?: string; code?: string }
    | { kind: 'unauthorized'; message: string; code?: string }
    | { kind: 'forbidden'; message: string; code?: string }
    | { kind: 'not-found'; message: string; code?: string }
    | { kind: 'conflict'; message: string; code?: string }
    | { kind: 'infrastructure'; message: string; code?: string; cause?: unknown };

export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: ApplicationError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: ApplicationError): Result<T> => ({ ok: false, error });
```

`mapSupabaseError`는 공개 error token만 한국어 메시지로 매핑하고 나머지는 `cause`를 보존하되 UI message에는 원문을 넣지 않는다.

- [ ] **Step 4: Browser client singleton을 새 경계로 이동하고 legacy export가 같은 instance를 사용하게 변경**

```ts
// src/shared/infrastructure/supabase/browser-client.ts
export const browserSupabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// src/app/lib/supabaseClient.ts
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
export { browserSupabaseClient as supabase };
const supabase = browserSupabaseClient;
export const SCM = new SupabaseClientManager(supabase);
```

`server-client.ts`는 기존 `createSupabaseServerClient`의 cookie-aware 구현을 옮기고 호출마다 새 client를 반환한다. `service-client.ts`는 `import 'server-only'` 경계 안에서만 service key factory를 제공한다. 기존 `src/app/lib/supabaseServer.ts`는 server factory를 re-export하고, `supabaseServerManager.ts`의 직접 `createClient` 호출은 service factory로 대체한다.

- [ ] **Step 5: 새 계층의 금지 import와 타입 생성 경로를 고정**

`eslint.config.mjs`에 `src/modules/*/domain/**/*.ts`와 `src/modules/*/application/**/*.ts` 대상 `no-restricted-imports` 규칙을 추가해 `@supabase/*`, `@/src/app/types/database.types`, `@/src/shared/infrastructure/*`를 금지한다. `package.json`의 `gen-type` 출력 경로는 실제 생성 타입 위치인 `src/app/types/database.types.ts`로 수정한다.

- [ ] **Step 6: 단위 테스트와 lint 실행**

Run: `npx jest src/__tests__/shared/infrastructure/supabase/map-supabase-error.test.ts src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts --runInBand`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 7: 공통 경계 커밋**

```bash
git add eslint.config.mjs package.json src/shared src/app/lib/supabaseClient.ts src/app/lib/supabaseServer.ts src/app/lib/supabase/supabaseServerManager.ts src/__tests__/shared
git commit -m "refactor: add data access application boundary"
```

### Task 2: 단어 승인 입력 정규화와 배치 정책

**Files:**
- Create: `src/modules/word-moderation/domain/word-approval.ts`
- Create: `src/__tests__/modules/word-moderation/domain/word-approval.test.ts`

**Interfaces:**
- Consumes: `Result<T>` from Task 1
- Produces: `RawWordApprovalEntry`, `NormalizedWordApprovalEntry`
- Produces: `normalizeWordApprovalEntries(entries): Result<NormalizedWordApprovalEntry[]>`
- Produces: `splitWordApprovalBatches(entries, batchSize): Result<NormalizedWordApprovalEntry[][]>`
- Produces: `isNoInjungTheme(themeCodes): boolean`

- [ ] **Step 1: 정규화와 검증의 실패 테스트 작성**

```ts
it('공백을 제거하고 중복 단어와 주제를 합친 뒤 결정적으로 정렬한다', () => {
    const result = normalizeWordApprovalEntries([
        { word: ' 나비 ', themeCodes: ['20', '10', '10'] },
        { word: '가방', themeCodes: ['30'] },
        { word: '나비', themeCodes: ['40'] },
    ]);

    expect(result).toEqual({
        ok: true,
        value: [
            { word: '가방', themeCodes: ['30'], noinCanUse: true },
            { word: '나비', themeCodes: ['10', '20', '40'], noinCanUse: true },
        ],
    });
});

it('빈 단어와 빈 주제 코드를 거부한다', () => {
    expect(normalizeWordApprovalEntries([{ word: ' ', themeCodes: ['10'] }])).toMatchObject({
        ok: false,
        error: { kind: 'validation', field: 'word' },
    });
    expect(normalizeWordApprovalEntries([{ word: '가방', themeCodes: [' '] }])).toMatchObject({
        ok: false,
        error: { kind: 'validation', field: 'themeCodes' },
    });
});

it('배치 크기는 1 이상 50 이하여야 한다', () => {
    expect(splitWordApprovalBatches([], 0)).toMatchObject({ ok: false });
    expect(splitWordApprovalBatches([], 51)).toMatchObject({ ok: false });
});
```

- [ ] **Step 2: 테스트가 누락 모듈 때문에 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/domain/word-approval.test.ts --runInBand`

Expected: FAIL because `word-approval.ts` does not exist.

- [ ] **Step 3: 순수 도메인 규칙 최소 구현**

```ts
export const MAX_WORD_APPROVAL_BATCH_SIZE = 50;

export type RawWordApprovalEntry = { word: string; themeCodes: string[] };
export type NormalizedWordApprovalEntry = {
    word: string;
    themeCodes: string[];
    noinCanUse: boolean;
};

export function isNoInjungTheme(themeCodes: readonly string[]): boolean {
    const noInjungCodes = new Set(Array.from({ length: 54 }, (_, index) => String(index * 10)));
    return themeCodes.some((themeCode) => noInjungCodes.has(themeCode));
}
```

정규화는 `trim`, 단어별 merge, 주제 dedupe, `ko` locale 단어 정렬, code 문자열 정렬 순으로 수행한다. 빈 배열도 validation error로 반환한다.

- [ ] **Step 4: 도메인 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/domain/word-approval.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: 도메인 규칙 커밋**

```bash
git add src/modules/word-moderation/domain src/__tests__/modules/word-moderation/domain
git commit -m "refactor: extract word approval domain rules"
```

### Task 3: 결정적 payload hash와 operation 계약

**Files:**
- Create: `src/modules/word-moderation/application/word-approval-types.ts`
- Create: `src/modules/word-moderation/application/word-approval-payload.ts`
- Create: `src/modules/word-moderation/application/ports.ts`
- Create: `src/__tests__/modules/word-moderation/application/word-approval-payload.test.ts`

**Interfaces:**
- Consumes: `NormalizedWordApprovalEntry`, `Result<T>`
- Produces: `WordApprovalOperation`, `ApproveWordBatchCommand`, `ApproveWordBatchResult`, `StoredWordApprovalJob`, `ApprovalProgress`
- Produces: `WordApprovalOperationGateway`, `WordApprovalJobStore`
- Produces: `serializeApprovalEntries(entries): string`, `sha256(value): Promise<string>`, `buildApprovalPayload(entries, batchSize): Promise<WordApprovalPayload>`

- [ ] **Step 1: canonical serialization과 SHA-256 실패 테스트 작성**

```ts
it('같은 정규화 payload를 항상 같은 문자열로 직렬화한다', () => {
    expect(serializeApprovalEntries([
        { word: '가방', themeCodes: ['10', '20'], noinCanUse: true },
    ])).toBe('[{"word":"가방","themeCodes":["10","20"],"noinCanUse":true}]');
});

it('SHA-256을 소문자 64자리 hex로 반환한다', async () => {
    await expect(sha256('abc')).resolves.toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
});

it('각 배치 hash와 전체 input hash를 분리한다', async () => {
    const payload = await buildApprovalPayload(normalizedEntries, 1);
    expect(payload.batches).toHaveLength(2);
    expect(payload.inputHash).not.toBe(payload.batches[0].payloadHash);
    expect(payload.batches[0].batchIndex).toBe(0);
});
```

- [ ] **Step 2: 누락 모듈로 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/application/word-approval-payload.test.ts --runInBand`

Expected: FAIL because the application payload module does not exist.

- [ ] **Step 3: command, operation과 port 계약 정의**

```ts
export type WordApprovalOperationStatus = 'running' | 'completed' | 'cancelled';

export interface WordApprovalOperation {
    operationId: string;
    inputHash: string;
    totalEntries: number;
    totalBatches: number;
    completedBatches: Array<{
        batchIndex: number;
        payloadHash: string;
        result: ApproveWordBatchResult;
    }>;
    status: WordApprovalOperationStatus;
}

export interface ApproveWordBatchResult {
    approvedWordCount: number;
    addedThemeCount: number;
    removedThemeCount: number;
    processedRequestCount: number;
    affectedDocsIds: number[];
}

export interface StoredWordApprovalJob {
    operationId: string;
    inputHash: string;
    entries: NormalizedWordApprovalEntry[];
    batchSize: number;
    createdAt: string;
}

export interface ApprovalBatch {
    batchIndex: number;
    payloadHash: string;
    entries: NormalizedWordApprovalEntry[];
}

export interface WordApprovalPayload {
    inputHash: string;
    batches: ApprovalBatch[];
}

export interface StartWordApprovalOperationInput {
    operationId: string;
    inputHash: string;
    totalEntries: number;
    totalBatches: number;
}

export interface WordApprovalRunResult extends ApproveWordBatchResult {
    operationId: string;
}

export interface ApprovalProgress {
    completedEntries: number;
    totalEntries: number;
    completedBatches: number;
    totalBatches: number;
    stage: 'validating' | 'applying' | 'finalizing' | 'completed';
}

export interface ApproveWordBatchCommand {
    operationId: string;
    batchIndex: number;
    totalBatches: number;
    payloadHash: string;
    entries: NormalizedWordApprovalEntry[];
}

export interface WordApprovalOperationGateway {
    startOperation(input: StartWordApprovalOperationInput): Promise<Result<WordApprovalOperation>>;
    getOperation(operationId: string): Promise<Result<WordApprovalOperation>>;
    approveBatch(command: ApproveWordBatchCommand): Promise<Result<ApproveWordBatchResult>>;
    cancelOperation(operationId: string): Promise<Result<void>>;
}

export interface WordApprovalJobStore {
    save(job: StoredWordApprovalJob): Promise<void>;
    get(operationId: string): Promise<StoredWordApprovalJob | null>;
    listPending(): Promise<StoredWordApprovalJob[]>;
    remove(operationId: string): Promise<void>;
}
```

- [ ] **Step 4: Web Crypto 기반 hash와 배치 payload 최소 구현**

`serializeApprovalEntries`는 이미 정규화된 field 순서를 직접 구성해 JSON key 순서를 고정한다. `sha256`은 `TextEncoder`와 `crypto.subtle.digest('SHA-256', bytes)`만 사용한다. `buildApprovalPayload`는 전체 entries와 각 batch를 별도로 hash한다.

- [ ] **Step 5: payload 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/application/word-approval-payload.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: 계약과 hash 커밋**

```bash
git add src/modules/word-moderation/application src/__tests__/modules/word-moderation/application/word-approval-payload.test.ts
git commit -m "feat: define resumable word approval contracts"
```

### Task 4: 시작·중단·재개 Application Use Case

**Files:**
- Create: `src/modules/word-moderation/application/run-word-approval.ts`
- Create: `src/__tests__/modules/word-moderation/application/run-word-approval.test.ts`

**Interfaces:**
- Consumes: `WordApprovalOperationGateway`, `WordApprovalJobStore`, payload helpers
- Produces: `RunWordApprovalService.start(entries, onProgress)`, `.resume(operationId, onProgress)`, `.listPending()`, `.cancel(operationId)`
- Produces: `WordApprovalRunResult` with aggregate counts and operation ID

- [ ] **Step 1: fake port로 핵심 orchestration 실패 테스트 작성**

테스트 fake는 호출 인자를 배열에 기록하고 DB나 Supabase 형태를 노출하지 않는다. 다음 네 동작을 각각 독립 테스트로 작성한다.

```ts
it('로컬 job을 먼저 저장한 뒤 operation을 시작하고 배치를 순서대로 실행한다', async () => {
    const result = await service.start(rawEntries, onProgress);
    expect(result).toMatchObject({ ok: true, value: { operationId: 'operation-1' } });
    expect(events).toEqual(['store:save', 'gateway:start', 'gateway:batch:0', 'gateway:batch:1', 'store:remove']);
});

it('두 번째 배치가 실패하면 이후 배치를 호출하지 않고 job을 보존한다', async () => {
    gateway.failBatchIndex = 1;
    const result = await service.start(rawEntries, onProgress);
    expect(result).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
    expect(gateway.approvedIndexes).toEqual([0, 1]);
    expect(await store.get('operation-1')).not.toBeNull();
});

it('재개할 때 DB hash가 일치하는 완료 batch를 건너뛴다', async () => {
    gateway.operation.completedBatches = completedBatches.slice(0, 2);
    await service.resume('operation-1', onProgress);
    expect(gateway.approvedIndexes).toEqual([2]);
});

it('DB input hash와 로컬 payload hash가 다르면 mutation을 호출하지 않는다', async () => {
    gateway.operation.inputHash = 'different';
    const result = await service.resume('operation-1', onProgress);
    expect(result).toMatchObject({ ok: false, error: { kind: 'conflict' } });
    expect(gateway.approvedIndexes).toEqual([]);
});
```

- [ ] **Step 2: use case 누락으로 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/application/run-word-approval.test.ts --runInBand`

Expected: FAIL because `run-word-approval.ts` does not exist.

- [ ] **Step 3: 순차 실행과 재개를 최소 구현**

```ts
export class RunWordApprovalService {
    constructor(
        private readonly operationGateway: WordApprovalOperationGateway,
        private readonly jobStore: WordApprovalJobStore,
        private readonly createOperationId: () => string = () => crypto.randomUUID(),
        private readonly batchSize = MAX_WORD_APPROVAL_BATCH_SIZE,
    ) {}

    async start(
        entries: RawWordApprovalEntry[],
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>>;

    async resume(
        operationId: string,
        onProgress?: (progress: ApprovalProgress) => void,
    ): Promise<Result<WordApprovalRunResult>>;
}
```

`start`는 normalize → hash/batch → candidate job 저장 → `startOperation` 순서로 실행한다. DB가 같은 actor/input hash의 기존 running operation ID를 반환하면 candidate job을 제거하고 반환된 ID로 다시 저장한다. `resume`은 DB operation을 먼저 읽고 input hash, total entries, total batches와 각 완료 batch의 `payloadHash`를 대조한 뒤 첫 미완료 batch부터 순차 실행한다. 완료 batch result와 새 batch result는 합산하되 `affectedDocsIds`는 중복 제거한다. batch 실패 시 job을 지우지 않는다.

- [ ] **Step 4: use case 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/application/run-word-approval.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: use case 커밋**

```bash
git add src/modules/word-moderation/application/run-word-approval.ts src/__tests__/modules/word-moderation/application/run-word-approval.test.ts
git commit -m "feat: orchestrate resumable word approval batches"
```

### Task 5: IndexedDB 작업 저장소

**Files:**
- Create: `src/modules/word-moderation/infrastructure/browser/word-approval-job-db.ts`
- Create: `src/__tests__/modules/word-moderation/infrastructure/browser/word-approval-job-db.test.ts`

**Interfaces:**
- Consumes: `WordApprovalJobStore`, `StoredWordApprovalJob`
- Produces: `IndexedDbWordApprovalJobStore`
- Database: `KkukoUtilsOperations`, version `1`, object store `word-approval-jobs`, key path `operationId`

- [ ] **Step 1: 실제 저장소 계약을 나타내는 실패 테스트 작성**

```ts
it('operationId를 key로 job을 저장하고 조회한다', async () => {
    await store.save(job);
    expect(objectStore.put).toHaveBeenCalledWith(job);
    await expect(store.get(job.operationId)).resolves.toEqual(job);
});

it('생성 시각 순서로 pending job을 반환한다', async () => {
    database.getAll.mockResolvedValue([newerJob, olderJob]);
    await expect(store.listPending()).resolves.toEqual([olderJob, newerJob]);
});

it('완료한 operation payload를 삭제한다', async () => {
    await store.remove(job.operationId);
    expect(database.delete).toHaveBeenCalledWith('word-approval-jobs', job.operationId);
});
```

- [ ] **Step 2: 저장소 누락으로 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/word-approval-job-db.test.ts --runInBand`

Expected: FAIL because `word-approval-job-db.ts` does not exist.

- [ ] **Step 3: `idb` adapter 최소 구현**

```ts
interface WordApprovalDatabaseSchema extends DBSchema {
    'word-approval-jobs': {
        key: string;
        value: StoredWordApprovalJob;
        indexes: { 'by-created-at': string };
    };
}

export class IndexedDbWordApprovalJobStore implements WordApprovalJobStore {
    async save(job: StoredWordApprovalJob): Promise<void>;
    async get(operationId: string): Promise<StoredWordApprovalJob | null>;
    async listPending(): Promise<StoredWordApprovalJob[]>;
    async remove(operationId: string): Promise<void>;
}
```

`openDB` promise는 adapter instance 안에서 재사용하고 upgrade 때 object store와 `by-created-at` index를 생성한다.

- [ ] **Step 4: IndexedDB adapter 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/word-approval-job-db.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: IndexedDB adapter 커밋**

```bash
git add src/modules/word-moderation/infrastructure/browser/word-approval-job-db.ts src/__tests__/modules/word-moderation/infrastructure/browser/word-approval-job-db.test.ts
git commit -m "feat: persist pending word approval jobs"
```

### Task 6: 원자적·멱등적 승인 SQL migration

**Files:**
- Create: `supabase/migrations/20260820000000_add_word_approval_batch.sql`

**Interfaces:**
- Produces RPC: `public.start_word_approval_operation(uuid, text, integer, integer) -> jsonb`
- Produces RPC: `public.get_word_approval_operation(uuid) -> jsonb`
- Produces RPC: `public.apply_word_approval_batch(uuid, integer, integer, text, jsonb) -> jsonb`
- Produces RPC: `public.cancel_word_approval_operation(uuid) -> jsonb`
- Produces tables: `public.word_approval_operations`, `public.word_approval_batches`
- Produces helper: `private.assert_word_approval_admin() -> uuid`

- [ ] **Step 1: migration을 하나의 명시적 transaction으로 작성**

테이블 계약은 아래 column과 constraint를 그대로 사용한다.

```sql
begin;

create schema if not exists private;

create table public.word_approval_operations (
    operation_id uuid primary key,
    actor_id uuid not null references public.users(id),
    input_hash text not null check (length(input_hash) = 64),
    total_entries integer not null check (total_entries > 0),
    total_batches integer not null check (total_batches > 0),
    status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create unique index word_approval_operations_running_input_key
    on public.word_approval_operations (actor_id, input_hash)
    where status = 'running';

create table public.word_approval_batches (
    operation_id uuid not null references public.word_approval_operations(operation_id) on delete cascade,
    batch_index integer not null check (batch_index >= 0),
    payload_hash text not null check (length(payload_hash) = 64),
    entry_count integer not null check (entry_count between 1 and 50),
    result jsonb not null,
    committed_at timestamptz not null default now(),
    primary key (operation_id, batch_index)
);

alter table public.word_approval_operations enable row level security;
alter table public.word_approval_batches enable row level security;
```

- [ ] **Step 2: 관리자 인증 helper와 hardened public RPC 작성**

모든 RPC는 `SECURITY DEFINER SET search_path = ''`와 schema-qualified object name을 사용한다. helper는 `auth.uid()`가 null이면 `WORD_APPROVAL_UNAUTHORIZED`, `public.users.role <> 'admin'`이면 `WORD_APPROVAL_FORBIDDEN`을 `P0001`로 raise한다.

```sql
create or replace function private.assert_word_approval_admin()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
begin
    if actor is null then
        raise exception using errcode = 'P0001', message = 'WORD_APPROVAL_UNAUTHORIZED';
    end if;
    if not exists (
        select 1 from public.users where id = actor and role = 'admin'
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_APPROVAL_FORBIDDEN';
    end if;
    return actor;
end;
$$;
```

`start_word_approval_operation`은 같은 operation ID 재요청의 metadata가 같으면 기존 row와 완료 batch의 index/hash/result를 반환한다. 같은 actor/input hash의 running operation이 있으면 그 operation을 반환해 IndexedDB가 사라진 브라우저도 동일 파일로 재개할 수 있게 한다. metadata가 다르면 `WORD_APPROVAL_CONFLICT`를 반환한다. `get_word_approval_operation`도 완료 batch의 index/hash/result를 같은 shape로 반환한다.

- [ ] **Step 3: batch validation, lock, idempotency와 side effect를 구현**

`apply_word_approval_batch`는 다음 순서를 함수 body에 그대로 반영한다.

1. 관리자 helper 호출
2. `word_approval_operations ... FOR UPDATE`로 operation을 잠그고 actor와 total batches 검사
3. 같은 `(operation_id, batch_index)` 완료 row가 있으면 같은 hash일 때 기존 `result`를 즉시 반환하고 다른 hash일 때 `WORD_APPROVAL_CONFLICT`
4. 완료 row가 없을 때 operation이 running인지와 `batch_index = 현재 완료 batch 수`인지 검사해 순차 실행 강제
5. JSON array, 1~50개, `word/themeCodes/noinCanUse` 형태, 중복 word, 존재하지 않는 theme code 검사. `noinCanUse`는 theme code 정책으로 DB에서 다시 계산해 payload 값과 다르면 거부
6. 대상 `wait_words`, `word_themes_wait`, `words`, `word_themes` row lock
7. 단어 upsert, canonical theme 집합 반영, `logs`, `docs_logs`, 기존 `public.increment_contribution`과 `public.update_last_updates` 호출, 대기 요청 정리
8. `word_approval_batches` 결과 기록
9. 완료 batch 수가 `total_batches`와 같으면 operation을 `completed`로 변경
10. 다음 JSON 결과 반환

```json
{
  "approvedWordCount": 0,
  "addedThemeCount": 0,
  "removedThemeCount": 0,
  "processedRequestCount": 0,
  "affectedDocsIds": []
}
```

함수 내 예외는 해당 호출 transaction 전체를 rollback하므로 실패 row를 같은 transaction에 기록하지 않는다. 완료 batch row가 없는 index만 재시도 대상으로 남긴다.

- [ ] **Step 4: 함수·테이블 권한을 최소화**

```sql
revoke all on table public.word_approval_operations from public, anon, authenticated;
revoke all on table public.word_approval_batches from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

revoke all on function private.assert_word_approval_admin() from public, anon, authenticated;
revoke all on function public.start_word_approval_operation(uuid, text, integer, integer) from public, anon;
revoke all on function public.get_word_approval_operation(uuid) from public, anon;
revoke all on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb) from public, anon;
revoke all on function public.cancel_word_approval_operation(uuid) from public, anon;

grant execute on function public.start_word_approval_operation(uuid, text, integer, integer) to authenticated;
grant execute on function public.get_word_approval_operation(uuid) to authenticated;
grant execute on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb) to authenticated;
grant execute on function public.cancel_word_approval_operation(uuid) to authenticated;

commit;
```

새 operation/batch 테이블 외의 기존 table grant는 다른 화면이 아직 직접 mutation하므로 이번 migration에서 revoke하지 않는다.

- [ ] **Step 5: SQL 정적 검토**

Run: `npx supabase db lint --local`

Expected: 로컬 Supabase가 실행 중이고 기준 schema가 있으면 exit 0. 기준 schema가 저장소에 없어 실행할 수 없으면 그 사실을 배포 handoff에 명시하고, `begin/commit`, 함수 signature, schema qualification, revoke/grant와 object dependency를 수동 대조한다. Remote DB에는 연결하지 않는다.

- [ ] **Step 6: migration만 별도 커밋**

```bash
git add -f supabase/migrations/20260820000000_add_word_approval_batch.sql
git commit -m "feat: add atomic word approval batch rpc"
```

### Task 7: 프로덕션 수동 배포 체크포인트

**Files:**
- Inspect: `supabase/migrations/20260820000000_add_word_approval_batch.sql`
- Do not modify: `src/app/types/database.types.ts`

**Interfaces:**
- Handoff to user: migration path, commit, DB object list, apply order, read-only verification queries
- Hard stop: user confirmation before implementation 구간 B

- [ ] **Step 1: 사용자에게 migration 전달**

Supabase SQL Editor에서 migration 파일 전체를 한 번에 실행하도록 안내한다. Codex는 Dashboard 조작, `supabase db push`, remote migration을 실행하지 않는다.

- [ ] **Step 2: 적용 후 read-only catalog 검증 query 전달**

```sql
select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema in ('public', 'private')
  and routine_name in (
    'assert_word_approval_admin',
    'start_word_approval_operation',
    'get_word_approval_operation',
    'apply_word_approval_batch',
    'cancel_word_approval_operation'
  )
order by routine_schema, routine_name;

select
  has_function_privilege('anon', 'public.apply_word_approval_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.apply_word_approval_batch(uuid,integer,integer,text,jsonb)', 'EXECUTE') as authenticated_can_execute;

select relname, relrowsecurity
from pg_class
where oid in (
  'public.word_approval_operations'::regclass,
  'public.word_approval_batches'::regclass
)
order by relname;
```

Expected:
- public RPC 네 개와 private helper 한 개가 존재한다.
- public RPC는 `DEFINER`, `anon_can_execute = false`, `authenticated_can_execute = true`다.
- operation/batch 두 테이블의 `relrowsecurity = true`다.

- [ ] **Step 3: 명시적으로 중단**

사용자가 적용 성공을 알려주기 전에는 다음 task를 실행하지 않는다. 적용 실패 시 SQL Editor의 전체 PostgreSQL error code/message와 실패 statement 위치만 요청한다.

---

## 구현 구간 B: 사용자의 프로덕션 DB 적용 확인 후

### Task 8: 원격 생성 타입 동기화와 Browser RPC Gateway

**Files:**
- Generated: `src/app/types/database.types.ts`
- Create: `src/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.ts`
- Create: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.test.ts`

**Interfaces:**
- Consumes: generated `Database`, `browserSupabaseClient`, `mapSupabaseError`, `WordApprovalOperationGateway`
- Produces: `SupabaseWordModerationGateway`

- [ ] **Step 1: 원격 schema 타입 생성**

Run: `npm run gen-type`

Expected: exit 0 and generated `Database['public']['Functions']` contains all four approval RPC signatures. 생성 파일은 직접 보정하지 않는다.

- [ ] **Step 2: RPC argument와 result mapping 실패 테스트 작성**

```ts
it('application command를 snake_case RPC argument로 변환한다', async () => {
    rpc.mockResolvedValue({ data: successfulBatchResult, error: null });
    await gateway.approveBatch(command);
    expect(rpc).toHaveBeenCalledWith('apply_word_approval_batch', {
        p_operation_id: command.operationId,
        p_batch_index: command.batchIndex,
        p_total_batches: command.totalBatches,
        p_payload_hash: command.payloadHash,
        p_entries: command.entries,
    });
});

it('공개 DB error token을 ApplicationError로 변환한다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'WORD_APPROVAL_CONFLICT' } });
    await expect(gateway.approveBatch(command)).resolves.toMatchObject({
        ok: false,
        error: { kind: 'conflict' },
    });
});
```

- [ ] **Step 3: 테스트가 gateway 누락으로 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.test.ts --runInBand`

Expected: FAIL because the gateway does not exist.

- [ ] **Step 4: 네 RPC adapter와 mapper 최소 구현**

Gateway만 generated DB 타입과 Supabase SDK 응답을 알고, application에는 `Result`와 camelCase DTO만 반환한다. `getOperation`은 DB의 completed batch index/hash/result를 index 오름차순으로 정규화한다.

- [ ] **Step 5: gateway 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: 타입과 gateway 커밋**

```bash
git add src/app/types/database.types.ts src/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.ts src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-moderation-gateway.test.ts
git commit -m "feat: connect word approval rpc gateway"
```

### Task 9: Browser Composition Root와 React Query Hook

**Files:**
- Create: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Create: `src/modules/word-moderation/presentation/use-word-approval.ts`
- Create: `src/modules/word-moderation/index.ts`
- Create: `src/__tests__/modules/word-moderation/presentation/use-word-approval.test.tsx`

**Interfaces:**
- Produces: `createBrowserWordModerationServices()` singleton composition root
- Produces: `useWordApproval()` with `start`, `resume`, `cancel`, `pendingJobs`, `progress`, `isProcessing`, `error`

- [ ] **Step 1: hook의 사용자 관찰 동작 실패 테스트 작성**

```tsx
it('승인 중 progress를 갱신하고 성공 후 pending 목록을 비운다', async () => {
    const { result } = renderHook(() => useWordApproval(service), { wrapper: queryClientWrapper });
    await act(async () => result.current.start(rawEntries));
    expect(result.current.progress).toMatchObject({ stage: 'completed', completedBatches: 2 });
    expect(result.current.pendingJobs).toEqual([]);
});

it('실패한 작업을 pending으로 유지하고 resume을 노출한다', async () => {
    service.startResult = infrastructureFailure;
    const { result } = renderHook(() => useWordApproval(service), { wrapper: queryClientWrapper });
    await act(async () => result.current.start(rawEntries));
    expect(result.current.error?.kind).toBe('infrastructure');
    expect(result.current.pendingJobs).toHaveLength(1);
});
```

- [ ] **Step 2: hook 누락으로 실패하는지 확인**

Run: `npx jest src/__tests__/modules/word-moderation/presentation/use-word-approval.test.tsx --runInBand`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: composition root와 mutation hook 최소 구현**

Composition root는 기존 browser Supabase singleton, `SupabaseWordModerationGateway`, `IndexedDbWordApprovalJobStore`, `RunWordApprovalService`를 한 번만 조립한다. Hook은 `useMutation`을 사용하고 infrastructure에 React state callback을 넘기지 않으며 application progress callback만 상태로 변환한다.

- [ ] **Step 4: hook 테스트 재실행**

Run: `npx jest src/__tests__/modules/word-moderation/presentation/use-word-approval.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: composition과 hook 커밋**

```bash
git add src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts src/modules/word-moderation/presentation src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/presentation
git commit -m "feat: expose browser word approval workflow"
```

### Task 10: 관리자 승인 UI를 command와 진행률만 다루도록 전환

**Files:**
- Create: `src/app/admin/add-words/WordApprovalPanel.tsx`
- Modify: `src/app/admin/add-words/AddWordsHome.tsx`
- Create: `src/__tests__/admin/add-words/WordApprovalPanel.test.tsx`
- Create: `src/__tests__/admin/add-words/AddWordsHome.test.tsx`

**Interfaces:**
- Consumes: `useWordApproval`, `RawWordApprovalEntry`, application progress/error
- Removes from component: `SCM`, `supabaseInQueryChunk`, `PostgrestError`, `isNoin`, table query construction
- Preserves: JSON file picker, preview, progress modal, completion indication, `ErrorModal`

- [ ] **Step 1: presentation 동작 실패 테스트 작성**

```tsx
it('유효한 JSON 파일의 entries를 승인 command로 전달한다', async () => {
    render(<WordApprovalPanel onStart={onStart} approvalState={idleState} />);
    await uploadJson({ 나비: ['10', '20'] });
    await user.click(screen.getByRole('button', { name: '처리 시작' }));
    expect(onStart).toHaveBeenCalledWith([{ word: '나비', themeCodes: ['10', '20'] }]);
});

it('중단된 작업을 표시하고 재개할 수 있다', async () => {
    render(<WordApprovalPanel onResume={onResume} approvalState={stateWithPendingJob} />);
    await user.click(screen.getByRole('button', { name: '작업 재개' }));
    expect(onResume).toHaveBeenCalledWith('operation-1');
});

it('application 오류를 ErrorModal용 안정된 정보로 표시한다', () => {
    render(<WordApprovalPanel approvalState={forbiddenState} />);
    expect(screen.getByText('관리자 권한이 필요합니다.')).toBeInTheDocument();
    expect(screen.queryByText(/relation|stack|SQL/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 새 presentation component 누락으로 실패하는지 확인**

Run: `npx jest src/__tests__/admin/add-words/WordApprovalPanel.test.tsx src/__tests__/admin/add-words/AddWordsHome.test.tsx --runInBand`

Expected: FAIL because `WordApprovalPanel.tsx` does not exist and `AddWordsHome` still performs direct DB work.

- [ ] **Step 3: UI와 container를 분리해 최소 구현**

`AddWordsHome`은 `useWordApproval()`을 호출해 panel props를 만들고, `WordApprovalPanel`은 파일 parsing, preview, 진행률과 resume/cancel 버튼만 렌더링한다. DB table, RPC name, Supabase 오류 타입은 두 component에 나타나지 않는다. `user.uuid`와 Redux role은 버튼 비활성화/빠른 안내에만 사용하고 command actor로 보내지 않는다.

- [ ] **Step 4: component 테스트 재실행**

Run: `npx jest src/__tests__/admin/add-words/WordApprovalPanel.test.tsx src/__tests__/admin/add-words/AddWordsHome.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: UI 전환 커밋**

```bash
git add src/app/admin/add-words src/__tests__/admin/add-words
git commit -m "refactor: use resumable word approval workflow"
```

### Task 11: 대체된 SCM API 정리

**Files:**
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`

**Interfaces:**
- Removes: `IAddManager.words`, `IAddManager.wordsThemes`, `IDeleteManager.wordsWaitThemesByIds`
- Preserves: `allWaitWords`, `allWordWaitTheme`, `waitWordsThemes`, `wordsByWords`, `wordTheme`, `userContribution`, `docsLastUpdate` because other screens still use them
- Preserves: `supabaseInQueryChunk` because other features still use it

- [ ] **Step 1: 제거 대상의 사용처가 0개인지 확인**

Run: `rg -n "SCM\.add\(\)\.(words|wordsThemes)\(|SCM\.delete\(\)\.wordsWaitThemesByIds\(" src/app`

Expected: no matches.

- [ ] **Step 2: 대체된 interface와 구현만 제거**

`words`, `wordsThemes`, `wordsWaitThemesByIds` 선언과 method body를 삭제한다. 이름이 유사한 `word`, `wordThemes`, `waitWordThemes`는 다른 흐름에서 사용되므로 유지한다.

- [ ] **Step 3: TypeScript 검사로 누락 사용처 확인**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: SCM 정리 커밋**

```bash
git add src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts
git commit -m "refactor: remove replaced word approval queries"
```

### Task 12: 전체 회귀와 수용 기준 검증

**Files:**
- Verify: all files changed by Tasks 1-11
- Inspect: `docs/superpowers/specs/2026-08-20-ddd-lite-data-access-refactoring-design.md`

**Interfaces:**
- Verifies: no direct DB orchestration in `AddWordsHome`
- Verifies: Domain/Application import boundaries
- Verifies: lint, type check, related tests, full tests, production build

- [ ] **Step 1: 금지 import와 `/api` 우회 여부 검사**

Run: `rg -n "SCM|supabaseInQueryChunk|@supabase|database\.types|/api" src/app/admin/add-words src/modules/word-moderation/domain src/modules/word-moderation/application`

Expected: no matches. Application type names에 `/api` 문자열을 사용하지 않는다.

- [ ] **Step 2: 관련 테스트 전체 실행**

Run: `npx jest src/__tests__/shared src/__tests__/modules/word-moderation src/__tests__/admin/add-words --runInBand`

Expected: all suites pass with 0 failures.

- [ ] **Step 3: 프로젝트 정적 검사 실행**

Run: `npm run lint`

Expected: exit 0.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: 전체 Jest 회귀 실행**

Run: `npm run test -- --runInBand`

Expected: all suites pass with 0 failures. Pre-existing failure가 있으면 수정 범위와 관계를 증거로 분리해 보고한다.

- [ ] **Step 5: production build 실행**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 6: diff와 migration scope 검증**

Run: `git diff --check`

Expected: exit 0.

Run: `git status --short`

Expected: 계획에 포함된 파일만 표시되거나 모든 구현 commit 후 clean.

- [ ] **Step 7: 최종 검증 수정이 있으면 커밋**

```bash
git add eslint.config.mjs package.json src/shared src/modules/word-moderation src/app/admin/add-words src/app/lib/supabase src/app/lib/supabaseClient.ts src/app/types/database.types.ts src/__tests__ supabase/migrations/20260820000000_add_word_approval_batch.sql
git commit -m "test: verify resumable word approval workflow"
```

검증 수정이 없으면 빈 commit은 만들지 않는다.

## 구현 완료 판정

- `AddWordsHome`와 `WordApprovalPanel`이 Supabase SDK, SCM, table/RPC 이름을 모른다.
- 브라우저 → Supabase Database RPC 경로만 사용하며 Vercel Function 실행시간 제한에 의존하지 않는다.
- RPC가 사용자 JWT의 `auth.uid()`와 DB admin role을 검증한다.
- 각 batch가 commit 또는 rollback되고 같은 hash 재호출은 기존 결과를 반환한다.
- 같은 index의 다른 hash는 side effect 없이 conflict다.
- IndexedDB payload와 DB 완료 batch를 대조해 첫 미완료 batch부터 재개한다.
- IndexedDB가 사라져도 같은 input hash 파일을 다시 선택하면 actor의 running operation을 발견한다.
- 프로덕션 DB migration은 사용자가 직접 적용하며 생성 타입은 적용 확인 후 원격 schema에서 생성된다.
- lint, TypeScript, 관련/전체 Jest와 build 결과가 모두 기록된다.
