# Phase 4: SCM 점진적 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SupabaseClientManager(SCM)`을 완전히 제거하고, Phase 1–3에서 구축한 도메인 서비스로 43개 소비자 파일을 마이그레이션한다.

**Architecture:** Log/ReleaseNote 두 미구현 서비스를 먼저 추가하고, `supabaseClient.ts`에 서비스 싱글톤을 export한 뒤, 소비자 파일을 도메인별로 순차 이관한다. 마지막으로 SCM과 SupabaseClientManager를 삭제한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase JS v2, Jest, @testing-library/react

---

## 현재 상태 요약

### Phase 1–3 완료 서비스

| 서비스 | 컨테이너 | 주요 메서드 |
|--------|----------|------------|
| WordQueryService | WordServiceContainer | searchByPrefix, searchAdvanced, getWordInfo, getAllThemes, getWordState, ... |
| WordCommandService | WordServiceContainer | acceptAddRequest, rejectAddRequest, acceptDeleteRequest, addWord, addWordsBulk, ... |
| DocsQueryService | DocsServiceContainer | getAllDocs, getDocsById, getDocsLogs, getDocsLogsByFilter, ... |
| DocsCommandService | DocsServiceContainer | createDocs, updateDocs, deleteDocs, addStarDocs, ... |
| UserService | UserServiceContainer | getUserById, getUserByNickname, getUsersByNicknameExact, getAllUsers, setNickname, ... |
| AuthService | AuthServiceContainer | getSession, loginByGoogle, logout, onAuthStateChange |
| NotificationService | NotificationServiceContainer | getActiveModal, getAll, getById, create, update, deleteById, uploadImage |

### 미구현 서비스 (Phase 4 선행 과제)
- **LogService** — word log 조회/삭제, docs log 삭제
- **ReleaseNoteService** — release_note 테이블 조회

### SCM 소비자 파일 (43개)
그룹별 이관 순서: Notification → Auth → User → ReleaseNote/Log → Docs → Word → 최종 정리

---

## 파일 구조 (신규 생성)

```
src/lib/services/
├── domain/
│   ├── log/
│   │   ├── LogEntity.ts          # WordLogEntity, WordLogFilter
│   │   ├── LogRepository.ts      # ILogRepository
│   │   └── index.ts
│   └── release-note/
│       ├── ReleaseNoteEntity.ts  # ReleaseNoteEntity
│       ├── ReleaseNoteRepository.ts  # IReleaseNoteRepository
│       └── index.ts
├── application/
│   ├── log/
│   │   ├── LogService.ts
│   │   └── index.ts
│   └── release-note/
│       ├── ReleaseNoteService.ts
│       └── index.ts
├── infrastructure/supabase/
│   ├── SupabaseLogRepository.ts
│   └── SupabaseReleaseNoteRepository.ts
├── LogServiceContainer.ts
└── ReleaseNoteServiceContainer.ts
```

**수정 파일:**
- `src/app/lib/supabaseClient.ts` — 서비스 싱글톤 7개 export 추가
- `src/app/hooks/useNotice.ts`
- `src/app/notification/[id]/NotificationDetail.tsx`
- `src/app/notification/[id]/edit/page.tsx`
- `src/app/notification/components/NotificationWriteForm.tsx`
- `src/app/header.tsx`
- `src/app/AutoLogin.tsx`
- `src/app/auth/auth.tsx`
- `src/app/profile/[username]/ProfilePage.tsx`
- `src/app/admin/users/UsersList.tsx`
- `src/app/profile/ProfileHome.tsx`
- `src/app/release-note/ReleaseNote.tsx`
- `src/app/word/logs/LogsHome.tsx`
- `src/app/admin/logs/AdminLogsHome.tsx`
- `src/app/admin/logs/AdminLogsWrapper.tsx`
- `src/app/words-docs/WordsDocsHome.tsx`
- `src/app/words-docs/WordsDocsHomePage.tsx`
- `src/app/words-docs/[id]/DocsDataHome.tsx`
- `src/app/words-docs/[id]/DocsDataPage.tsx`
- `src/app/words-docs/[id]/info/DocsInfoPage.tsx`
- `src/app/words-docs/[id]/logs/DocsLogPage.tsx`
- `src/app/words-docs/[id]/TableWorkFunc.tsx`
- `src/app/admin/request-docs/RequestDocsHome.tsx`
- `src/app/admin/request-docs/RequestDocsWrapper.tsx`
- `src/app/admin/AdminPage.tsx`
- `src/app/word/lib.ts`
- `src/app/word/search/hooks/useWordSearch.ts`
- `src/app/word/search/[query]/SearchBar.tsx`
- `src/app/word/search/[query]/WordInfo.tsx`
- `src/app/word/search/[query]/WordInfoPage.tsx`
- `src/app/word/search/components/ThemeSelectionModal.tsx`
- `src/app/word/add/WordAddHome.tsx`
- `src/app/word/adds/WordsAddHome.tsx`
- `src/app/word/requests/RequestsHome.tsx`
- `src/app/word/stats/WordStatsHome.tsx`
- `src/app/word/words-download/WordsDownloadHome.tsx`
- `src/app/word-combiner/WordCombinerPage.tsx`
- `src/app/admin/add-words/AddWordsHome.tsx`
- `src/app/admin/del-words/DelWordsHome.tsx`
- `src/app/admin/request-words/AdminRequestHome.tsx`
- `src/app/admin/request-words/AdminWrapper.tsx`
- `src/app/admin/request-words/ThemeSelectModal.tsx`
- `src/app/api/words/search/route.ts`
- `src/app/admin/api-server/api.ts`

**삭제 파일 (Task 13):**
- `src/app/lib/supabase/SupabaseClientManager.ts`
- `src/app/lib/supabase/ISupabaseClientManager.ts` (존재하는 경우)

---

## 공통 마이그레이션 패턴

### Result<T, E> 변환 패턴

```ts
// 기존 (SCM — raw Supabase error)
const { data, error } = await SCM.get().someMethod();
if (error) { handleError(error); return; }
useData(data);

// 신규 (Domain Service — Result<T, CustomError>)
const result = await container.service.someMethod();
if (!result.success) { handleError(result.error); return; }
useData(result.data);
```

### onAuthStateChange 패턴 변환

```ts
// 기존 (SCM — Supabase 구조 노출)
const { data: authListener } = SCM.onAuthStateChange(callback);
return () => { authListener.subscription.unsubscribe(); };

// 신규 (AuthService — 추상화된 구조)
const listener = authContainer.service.onAuthStateChange(callback);
return () => { listener.unsubscribe(); };
```

---

## Task 1: Log 도메인 구현

**Files:**
- Create: `src/lib/services/domain/log/LogEntity.ts`
- Create: `src/lib/services/domain/log/LogRepository.ts`
- Create: `src/lib/services/domain/log/index.ts`
- Create: `src/lib/services/application/log/LogService.ts`
- Create: `src/lib/services/application/log/index.ts`
- Create: `src/lib/services/infrastructure/supabase/SupabaseLogRepository.ts`
- Create: `src/lib/services/LogServiceContainer.ts`
- Test: `src/__tests__/lib/services/application/log/LogService.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/__tests__/lib/services/application/log/LogService.test.ts
import { LogService } from '@/src/lib/services/application/log/LogService';
import type { ILogRepository } from '@/src/lib/services/domain/log/LogRepository';
import type { WordLogEntity, WordLogFilter } from '@/src/lib/services/domain/log/LogEntity';
import { success, failure } from '@/src/lib/services/domain/result';

const mockLogRepo: jest.Mocked<ILogRepository> = {
    findWordLogsByFilter: jest.fn(),
    deleteWordLogsByIds: jest.fn(),
    deleteDocsLogsByIds: jest.fn(),
};

const service = new LogService(mockLogRepo);

const sampleLog: WordLogEntity = {
    id: 1,
    word: '사과',
    state: 'approved',
    requestType: 'add',
    madeBy: 'user-uuid',
    processedBy: 'admin-uuid',
    createdAt: '2026-01-01T00:00:00Z',
    madeByUser: { nickname: '홍길동' },
    processedByUser: { nickname: '관리자' },
};

const filter: WordLogFilter = { filterState: 'all', filterType: 'all', from: 0, to: 29 };

beforeEach(() => jest.clearAllMocks());

test('getWordLogsByFilter — 성공 시 data와 count 반환', async () => {
    mockLogRepo.findWordLogsByFilter.mockResolvedValue(
        success({ data: [sampleLog], count: 1 })
    );
    const result = await service.getWordLogsByFilter(filter);
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.count).toBe(1);
    }
});

test('getWordLogsByFilter — 인프라 에러 전파', async () => {
    mockLogRepo.findWordLogsByFilter.mockResolvedValue(
        failure({ name: 'InfrastructureError', message: 'DB error', httpStatus: 500, code: 'INFRA' })
    );
    const result = await service.getWordLogsByFilter(filter);
    expect(result.success).toBe(false);
});

test('deleteWordLogsByIds — 성공', async () => {
    mockLogRepo.deleteWordLogsByIds.mockResolvedValue(success(undefined));
    const result = await service.deleteWordLogsByIds([1, 2, 3]);
    expect(result.success).toBe(true);
    expect(mockLogRepo.deleteWordLogsByIds).toHaveBeenCalledWith([1, 2, 3]);
});

test('deleteDocsLogsByIds — 성공', async () => {
    mockLogRepo.deleteDocsLogsByIds.mockResolvedValue(success(undefined));
    const result = await service.deleteDocsLogsByIds([5, 6]);
    expect(result.success).toBe(true);
    expect(mockLogRepo.deleteDocsLogsByIds).toHaveBeenCalledWith([5, 6]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx jest src/__tests__/lib/services/application/log/LogService.test.ts -v
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 도메인 엔티티 작성**

```ts
// src/lib/services/domain/log/LogEntity.ts
import type { Result, CustomError } from '../result';

export interface WordLogEntity {
    id: number;
    word: string;
    state: 'approved' | 'rejected' | 'pending';
    requestType: 'add' | 'delete';
    madeBy: string | null;
    processedBy: string | null;
    createdAt: string;
    madeByUser: { nickname: string } | null;
    processedByUser: { nickname: string | null } | null;
}

export interface WordLogFilter {
    filterState: 'approved' | 'rejected' | 'pending' | 'all';
    filterType: 'add' | 'delete' | 'all';
    from: number;
    to: number;
}
```

- [ ] **Step 4: 레포지토리 인터페이스 작성**

```ts
// src/lib/services/domain/log/LogRepository.ts
import type { Result, CustomError } from '../result';
import type { WordLogEntity, WordLogFilter } from './LogEntity';

export interface ILogRepository {
    findWordLogsByFilter(filter: WordLogFilter): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>>;
    deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;
    deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;
}
```

```ts
// src/lib/services/domain/log/index.ts
export type { WordLogEntity, WordLogFilter } from './LogEntity';
export type { ILogRepository } from './LogRepository';
```

- [ ] **Step 5: 애플리케이션 서비스 작성**

```ts
// src/lib/services/application/log/LogService.ts
import type { ILogRepository } from '../../domain/log/LogRepository';
import type { Result, CustomError } from '../../domain/result';
import type { WordLogEntity, WordLogFilter } from '../../domain/log/LogEntity';

export class LogService {
    constructor(private readonly repo: ILogRepository) {}

    async getWordLogsByFilter(
        filter: WordLogFilter
    ): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>> {
        return this.repo.findWordLogsByFilter(filter);
    }

    async deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteWordLogsByIds(ids);
    }

    async deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteDocsLogsByIds(ids);
    }
}
```

```ts
// src/lib/services/application/log/index.ts
export { LogService } from './LogService';
```

- [ ] **Step 6: 인프라 구현 작성**

```ts
// src/lib/services/infrastructure/supabase/SupabaseLogRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { ILogRepository } from '../../domain/log/LogRepository';
import type { WordLogEntity, WordLogFilter } from '../../domain/log/LogEntity';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

function toWordLogEntity(row: {
    id: number;
    word: string;
    state: 'approved' | 'rejected' | 'pending';
    r_type: 'add' | 'delete';
    make_by: string | null;
    processed_by: string | null;
    created_at: string;
    make_by_user: { nickname: string } | null;
    processed_by_user: { nickname: string | null } | null;
}): WordLogEntity {
    return {
        id: row.id,
        word: row.word,
        state: row.state,
        requestType: row.r_type,
        madeBy: row.make_by,
        processedBy: row.processed_by,
        createdAt: row.created_at,
        madeByUser: row.make_by_user,
        processedByUser: row.processed_by_user,
    };
}

export class SupabaseLogRepository implements ILogRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findWordLogsByFilter(
        filter: WordLogFilter
    ): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>> {
        let query = this.supabase
            .from('logs')
            .select(
                `*, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)`,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false });

        if (filter.filterState !== 'all') query = query.eq('state', filter.filterState);
        if (filter.filterType !== 'all') query = query.eq('r_type', filter.filterType);
        query = query.range(filter.from, filter.to);

        const { data, error, count } = await query;
        if (error) return failure(infrastructureError(error));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return success({ data: (data ?? []).map((r) => toWordLogEntity(r as any)), count: count ?? 0 });
    }

    async deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('logs').delete().in('id', ids);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }

    async deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        const { error } = await this.supabase.from('docs_logs').delete().in('id', ids);
        if (error) return failure(infrastructureError(error));
        return success(undefined);
    }
}
```

- [ ] **Step 7: 컨테이너 작성**

```ts
// src/lib/services/LogServiceContainer.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseLogRepository } from './infrastructure/supabase/SupabaseLogRepository';
import { LogService } from './application/log/LogService';

export class LogServiceContainer {
    public readonly service: LogService;

    constructor(supabase: SupabaseClient<Database>) {
        const repo = new SupabaseLogRepository(supabase);
        this.service = new LogService(repo);
    }
}

export function createLogServiceContainer(supabase: SupabaseClient<Database>): LogServiceContainer {
    return new LogServiceContainer(supabase);
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npx jest src/__tests__/lib/services/application/log/LogService.test.ts -v
```
Expected: PASS (4 tests)

- [ ] **Step 9: 전체 테스트 회귀 확인**

```bash
npm test
```
Expected: 기존 테스트 모두 통과

- [ ] **Step 10: 커밋**

```bash
git add src/lib/services/domain/log/ src/lib/services/application/log/ src/lib/services/infrastructure/supabase/SupabaseLogRepository.ts src/lib/services/LogServiceContainer.ts src/__tests__/lib/services/application/log/
git commit -m "feat: log 도메인 서비스 구현 (LogEntity, LogService, SupabaseLogRepository)"
```

---

## Task 2: ReleaseNote 서비스 구현

**Files:**
- Create: `src/lib/services/domain/release-note/ReleaseNoteEntity.ts`
- Create: `src/lib/services/domain/release-note/ReleaseNoteRepository.ts`
- Create: `src/lib/services/domain/release-note/index.ts`
- Create: `src/lib/services/application/release-note/ReleaseNoteService.ts`
- Create: `src/lib/services/application/release-note/index.ts`
- Create: `src/lib/services/infrastructure/supabase/SupabaseReleaseNoteRepository.ts`
- Create: `src/lib/services/ReleaseNoteServiceContainer.ts`
- Test: `src/__tests__/lib/services/application/release-note/ReleaseNoteService.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/__tests__/lib/services/application/release-note/ReleaseNoteService.test.ts
import { ReleaseNoteService } from '@/src/lib/services/application/release-note/ReleaseNoteService';
import type { IReleaseNoteRepository } from '@/src/lib/services/domain/release-note/ReleaseNoteRepository';
import type { ReleaseNoteEntity } from '@/src/lib/services/domain/release-note/ReleaseNoteEntity';
import { success, failure } from '@/src/lib/services/domain/result';

const mockRepo: jest.Mocked<IReleaseNoteRepository> = {
    findAll: jest.fn(),
};

const service = new ReleaseNoteService(mockRepo);

const sampleNote: ReleaseNoteEntity = {
    id: 1,
    title: 'v1.0.0',
    content: '최초 릴리즈',
    createdAt: '2026-01-01T00:00:00Z',
    link: null,
};

beforeEach(() => jest.clearAllMocks());

test('getAll — 성공 시 엔티티 배열 반환', async () => {
    mockRepo.findAll.mockResolvedValue(success([sampleNote]));
    const result = await service.getAll();
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('v1.0.0');
    }
});

test('getAll — 인프라 에러 전파', async () => {
    mockRepo.findAll.mockResolvedValue(
        failure({ name: 'InfrastructureError', message: 'DB error', httpStatus: 500, code: 'INFRA' })
    );
    const result = await service.getAll();
    expect(result.success).toBe(false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx jest src/__tests__/lib/services/application/release-note/ReleaseNoteService.test.ts -v
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 도메인 파일 작성**

```ts
// src/lib/services/domain/release-note/ReleaseNoteEntity.ts
export interface ReleaseNoteEntity {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    link: string | null;
}
```

```ts
// src/lib/services/domain/release-note/ReleaseNoteRepository.ts
import type { Result, CustomError } from '../result';
import type { ReleaseNoteEntity } from './ReleaseNoteEntity';

export interface IReleaseNoteRepository {
    findAll(): Promise<Result<ReleaseNoteEntity[], CustomError>>;
}
```

```ts
// src/lib/services/domain/release-note/index.ts
export type { ReleaseNoteEntity } from './ReleaseNoteEntity';
export type { IReleaseNoteRepository } from './ReleaseNoteRepository';
```

- [ ] **Step 4: 애플리케이션 서비스 + 인프라 작성**

```ts
// src/lib/services/application/release-note/ReleaseNoteService.ts
import type { IReleaseNoteRepository } from '../../domain/release-note/ReleaseNoteRepository';
import type { Result, CustomError } from '../../domain/result';
import type { ReleaseNoteEntity } from '../../domain/release-note/ReleaseNoteEntity';

export class ReleaseNoteService {
    constructor(private readonly repo: IReleaseNoteRepository) {}

    async getAll(): Promise<Result<ReleaseNoteEntity[], CustomError>> {
        return this.repo.findAll();
    }
}
```

```ts
// src/lib/services/application/release-note/index.ts
export { ReleaseNoteService } from './ReleaseNoteService';
```

```ts
// src/lib/services/infrastructure/supabase/SupabaseReleaseNoteRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import type { IReleaseNoteRepository } from '../../domain/release-note/ReleaseNoteRepository';
import type { ReleaseNoteEntity } from '../../domain/release-note/ReleaseNoteEntity';
import type { Result, CustomError } from '../../domain/result';
import { success, failure } from '../../domain/result';
import { infrastructureError } from '../../domain/errors';

export class SupabaseReleaseNoteRepository implements IReleaseNoteRepository {
    constructor(private readonly supabase: SupabaseClient<Database>) {}

    async findAll(): Promise<Result<ReleaseNoteEntity[], CustomError>> {
        const { data, error } = await this.supabase
            .from('release_note')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return failure(infrastructureError(error));
        return success(
            (data ?? []).map((row) => ({
                id: row.id,
                title: row.title,
                content: row.content,
                createdAt: row.created_at,
                link: row.link ?? null,
            }))
        );
    }
}
```

```ts
// src/lib/services/ReleaseNoteServiceContainer.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseReleaseNoteRepository } from './infrastructure/supabase/SupabaseReleaseNoteRepository';
import { ReleaseNoteService } from './application/release-note/ReleaseNoteService';

export class ReleaseNoteServiceContainer {
    public readonly service: ReleaseNoteService;

    constructor(supabase: SupabaseClient<Database>) {
        this.service = new ReleaseNoteService(new SupabaseReleaseNoteRepository(supabase));
    }
}

export function createReleaseNoteServiceContainer(
    supabase: SupabaseClient<Database>
): ReleaseNoteServiceContainer {
    return new ReleaseNoteServiceContainer(supabase);
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest src/__tests__/lib/services/application/release-note/ReleaseNoteService.test.ts -v
```
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/services/domain/release-note/ src/lib/services/application/release-note/ src/lib/services/infrastructure/supabase/SupabaseReleaseNoteRepository.ts src/lib/services/ReleaseNoteServiceContainer.ts src/__tests__/lib/services/application/release-note/
git commit -m "feat: releaseNote 도메인 서비스 구현"
```

---

## Task 3: supabaseClient.ts에 서비스 싱글톤 export 추가

**Files:**
- Modify: `src/app/lib/supabaseClient.ts`

기존 `SCM` export는 **유지**한다. 마이그레이션 기간 동안 SCM과 서비스 싱글톤이 공존한다.

- [ ] **Step 1: supabaseClient.ts에 import 및 export 추가**

`src/app/lib/supabaseClient.ts` 파일을 읽고 맨 아래에 다음을 추가한다:

```ts
// 기존 import 블록 위에 추가
import { createWordServiceContainer } from '@/src/lib/services/WordServiceContainer';
import { createDocsServiceContainer } from '@/src/lib/services/DocsServiceContainer';
import { createUserServiceContainer } from '@/src/lib/services/UserServiceContainer';
import { createAuthServiceContainer } from '@/src/lib/services/AuthServiceContainer';
import { createNotificationServiceContainer } from '@/src/lib/services/NotificationServiceContainer';
import { createLogServiceContainer } from '@/src/lib/services/LogServiceContainer';
import { createReleaseNoteServiceContainer } from '@/src/lib/services/ReleaseNoteServiceContainer';
```

파일 맨 아래 `supabaseInQueryChunk` 함수 다음에 추가:

```ts
// Domain service singletons (replacing SCM progressively)
export const wordContainer = createWordServiceContainer(supabase);
export const docsContainer = createDocsServiceContainer(supabase);
export const userContainer = createUserServiceContainer(supabase);
export const authContainer = createAuthServiceContainer(supabase);
export const notificationContainer = createNotificationServiceContainer(supabase);
export const logContainer = createLogServiceContainer(supabase);
export const releaseNoteContainer = createReleaseNoteServiceContainer(supabase);
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/lib/supabaseClient.ts
git commit -m "feat: supabaseClient에 도메인 서비스 싱글톤 export 추가"
```

---

## Task 4: Notification 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/hooks/useNotice.ts`
- Modify: `src/app/notification/[id]/NotificationDetail.tsx`
- Modify: `src/app/notification/[id]/edit/page.tsx`
- Modify: `src/app/notification/components/NotificationWriteForm.tsx`

**SCM → Service 매핑:**

| 기존 (SCM) | 신규 (NotificationService) |
|-----------|--------------------------|
| `SCM.get().notice()` | `notificationContainer.service.getActiveModal()` |
| `SCM.delete().notificationById(id)` | `notificationContainer.service.deleteById(id)` |
| `SCM.get().notificationById(id)` | `notificationContainer.service.getById(id)` |
| `SCM.update().notification(id, data)` | `notificationContainer.service.update(id, data)` |
| `SCM.add().notification(data)` | `notificationContainer.service.create(data)` |
| `SCM.get().uploadImage(file, path)` | `notificationContainer.service.uploadImage(file, path)` |
| `SCM.get().deleteImage(path)` | `notificationContainer.service.deleteImage(path)` |
| `SCM.get().getPublicUrl(path)` | `notificationContainer.service.getPublicUrl(path)` |

- [ ] **Step 1: useNotice.ts 마이그레이션**

`SCM` import를 제거하고 `notificationContainer` import로 교체:

```ts
// 기존
import { SCM } from '@/src/app/lib/supabaseClient';

// 신규
import { notificationContainer } from '@/src/app/lib/supabaseClient';
```

`fetchNotice` 함수:
```ts
// 기존
const { data, error } = await SCM.get().notice();
if (error) { console.error('공지사항 가져오기 오류:', error); return; }
if (data) { ... }

// 신규
const result = await notificationContainer.service.getActiveModal();
if (!result.success) { console.error('공지사항 가져오기 오류:', result.error); return; }
if (result.data) { ... }
```

- [ ] **Step 2: NotificationDetail.tsx 마이그레이션**

```ts
// 기존
import { SCM } from "@/src/app/lib/supabaseClient";
const { error } = await SCM.delete().notificationById(notification.id);
if (error) throw error;

// 신규
import { notificationContainer } from "@/src/app/lib/supabaseClient";
const result = await notificationContainer.service.deleteById(notification.id);
if (!result.success) throw result.error;
```

- [ ] **Step 3: NotificationWriteForm.tsx 마이그레이션**

`SCM` import → `notificationContainer` import 교체.

create (신규):
```ts
// 기존
await SCM.add().notification({ title, body, img: imageUrl, end_at: endAt, is_important, is_modal });

// 신규
const result = await notificationContainer.service.create({ title, body, img: imageUrl, endAt, isImportant, isModal });
if (!result.success) { /* error */ return; }
```

update (수정):
```ts
// 기존
await SCM.update().notification(notification.id, { title, body, img: imageUrl, end_at: endAt, is_important, is_modal });

// 신규
const result = await notificationContainer.service.update(notification.id, { title, body, img: imageUrl, endAt, isImportant, isModal });
```

이미지 업로드:
```ts
// 기존
const { data: url, error } = await SCM.uploadImage(file, path);

// 신규
const result = await notificationContainer.service.uploadImage(file, path);
if (!result.success) { /* error */ return; }
const url = result.data;
```

**주의:** `NewNotification`/`UpdateNotification` 타입의 필드명이 camelCase인지 확인. `SupabaseNotificationRepository`에서 DB 컬럼명(snake_case)으로 변환됨.

- [ ] **Step 4: notification/[id]/edit/page.tsx 마이그레이션**

`notificationContainer.service.getById(id)` 사용.
Result 패턴 적용.

- [ ] **Step 5: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/app/hooks/useNotice.ts src/app/notification/
git commit -m "refactor: notification 소비자 파일을 NotificationService로 마이그레이션"
```

---

## Task 5: Auth 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/header.tsx`
- Modify: `src/app/AutoLogin.tsx`
- Modify: `src/app/auth/auth.tsx`

**SCM → Service 매핑:**

| 기존 (SCM) | 신규 |
|-----------|------|
| `SCM.logout()` | `authContainer.service.logout()` |
| `SCM.get().session()` | `authContainer.service.getSession()` |
| `SCM.loginByGoogle(origin)` | `authContainer.service.loginByGoogle(origin)` |
| `SCM.onAuthStateChange(fn)` | `authContainer.service.onAuthStateChange(fn)` |
| `SCM.get().userById(id)` | `userContainer.userService.getUserById(id)` |
| `SCM.get().usersByNickname(n)` | `userContainer.userService.getUsersByNicknameExact(n)` |
| `SCM.add().nickname(n)` | `userContainer.userService.setNickname(n)` |

- [ ] **Step 1: header.tsx 마이그레이션**

```ts
// 기존
import { SCM } from "./lib/supabaseClient";
await SCM.logout();

// 신규
import { authContainer } from "./lib/supabaseClient";
await authContainer.service.logout();
// Result를 무시해도 됨 (logout 실패 시 UI에서 알 수 없으므로 현재 코드도 error 처리 없음)
```

- [ ] **Step 2: AutoLogin.tsx 마이그레이션**

```ts
// 기존
import { SCM } from "./lib/supabaseClient";
const { data, error } = await SCM.get().session();
if (!data || !data.session || error) return;
const { data: dbdata, error: err } = await SCM.get().userById(data.session.user.id);
if (err || !dbdata) return;
dispatch(userAction.setInfo({ username: dbdata.nickname, role: dbdata.role ?? "guest", uuid: dbdata.id }));

// 신규
import { authContainer, userContainer } from "./lib/supabaseClient";
const sessionResult = await authContainer.service.getSession();
if (!sessionResult.success || !sessionResult.data) return;
const userResult = await userContainer.userService.getUserById(sessionResult.data.user.id);
if (!userResult.success || !userResult.data) return;
dispatch(userAction.setInfo({
    username: userResult.data.nickname,
    role: userResult.data.role ?? 'guest',
    uuid: userResult.data.id,
}));
```

- [ ] **Step 3: auth.tsx 마이그레이션**

```ts
import { authContainer, userContainer } from "@/src/app/lib/supabaseClient";
```

`onAuthStateChange` (구조 변환 주의):
```ts
// 기존
const { data: authListener } = SCM.onAuthStateChange(checkUser);
return () => { authListener.subscription.unsubscribe(); };

// 신규
const listener = authContainer.service.onAuthStateChange(checkUser);
return () => { listener.unsubscribe(); };
```

`checkUser` 내부 (`userById`):
```ts
// 기존
const { data, error: err } = await SCM.get().userById(session.user.id);

// 신규
const userResult = await userContainer.userService.getUserById(session.user.id);
if (userResult.success === false) {
    setErrorModalView({ ErrName: userResult.error.name, ErrMessage: userResult.error.message, ErrStackRace: null, inputValue: null });
    return;
}
const data = userResult.data;
```

`signInWithGoogle`:
```ts
// 기존
const { error: err } = await SCM.loginByGoogle(location.origin);
if (err) { ... handle Error or string ... }

// 신규
const result = await authContainer.service.loginByGoogle(location.origin);
if (!result.success) {
    setErrorModalView({ ErrName: result.error.name, ErrMessage: result.error.message, ErrStackRace: null, inputValue: null });
}
```

`completeSignup` (`session` + `usersByNickname` + `setNickname`):
```ts
// 기존
const session = await SCM.get().session();
if (!session.data.session) { setLoading(false); return; }
const { data: checkData, error: checkErr } = await SCM.get().usersByNickname(nickname);
if (checkErr) { ... }
if (checkData.length > 0) { setNicknameError("이미 사용 중인 닉네임입니다."); ... return; }
const { data, error:err } = await SCM.add().nickname(nickname);
if (err) { ... }
dispatch(userAction.setInfo({ username: data.nickname, role: data.role ?? "guest", uuid: data.id }));

// 신규
const sessionResult = await authContainer.service.getSession();
if (!sessionResult.success || !sessionResult.data) { setLoading(false); return; }

const checkResult = await userContainer.userService.getUsersByNicknameExact(nickname);
if (!checkResult.success) { setErrorModalView({ ... checkResult.error }); setLoading(false); return; }
if (checkResult.data.length > 0) { setNicknameError("이미 사용 중인 닉네임입니다."); setLoading(false); return; }

const setResult = await userContainer.userService.setNickname(nickname);
if (!setResult.success) { setErrorModalView({ ... setResult.error }); setLoading(false); return; }

// setNickname이 void를 반환하므로 사용자 정보를 별도 조회
const userResult = await userContainer.userService.getUserById(sessionResult.data.user.id);
if (!userResult.success || !userResult.data) { router.push('/'); return; }
dispatch(userAction.setInfo({
    username: userResult.data.nickname,
    role: userResult.data.role ?? 'guest',
    uuid: userResult.data.id,
}));
router.push("/");
```

- [ ] **Step 4: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/app/header.tsx src/app/AutoLogin.tsx src/app/auth/auth.tsx
git commit -m "refactor: auth 소비자 파일을 AuthService/UserService로 마이그레이션"
```

---

## Task 6: User 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/profile/[username]/ProfilePage.tsx`
- Modify: `src/app/profile/ProfileHome.tsx`
- Modify: `src/app/admin/users/UsersList.tsx`

**SCM → Service 매핑:**

| 기존 (SCM) | 신규 |
|-----------|------|
| `SCM.get().userByNickname(name)` | `userContainer.userService.getUserByNickname(name)` |
| `SCM.get().monthlyConRankByUserId(id)` | `userContainer.userService.getUserMonthlyRank(id)` |
| `SCM.get().monthlyContributionsByUserId(id)` | `userContainer.userService.getUserMonthlyContributions(id)` |
| `SCM.get().starredDocsById(id)` | `userContainer.userService.getUserStarredDocs(id)` |
| `SCM.get().waitWordsByUserId(id)` | `userContainer.userService.getUserWaitWordRequests(id)` |
| `SCM.get().logsByFilter({...})` (유저 로그) | `logContainer.service.getWordLogsByFilter({...})` |
| `SCM.add().starDocs({docsId, userId})` | `userContainer.userService.addStarDocs(userId, docsId)` |
| `SCM.delete().starDocs({docsId, userId})` | `userContainer.userService.removeStarDocs(userId, docsId)` |
| `SCM.get().allUser(sortField, isAsc)` | `userContainer.userService.getAllUsers({ field, ascending })` |
| `SCM.get().usersLikeByNickname(q)` | `userContainer.userService.searchUsersByNickname(q)` |

- [ ] **Step 1: ProfilePage.tsx 마이그레이션**

```ts
// 기존
import { SCM } from "@/src/app/lib/supabaseClient";

// 신규
import { userContainer, logContainer } from "@/src/app/lib/supabaseClient";
```

각 SCM 호출을 Result 패턴으로 교체. 예시:

```ts
// 기존
const { data: getUserData, error: getUserError } = await SCM.get().userByNickname(userName);
if (getUserError) { return makeError(getUserError); }

// 신규
const getUserResult = await userContainer.userService.getUserByNickname(userName);
if (!getUserResult.success) { return makeError(getUserResult.error as unknown as PostgrestError); }
const getUserData = getUserResult.data;
```

로그 탭 (ProfilePage의 `SCM.get().logsByFilter`):
```ts
// 기존
const { data, error, count } = await SCM.get().logsByFilter({ filterState, filterType, from, to });

// 신규
const result = await logContainer.service.getWordLogsByFilter({ filterState, filterType, from, to });
if (!result.success) { /* error */ return; }
const { data, count } = result.data;
```

**주의:** ProfilePage의 `makeError` 함수는 `PostgrestError` 타입을 받는다. `CustomError`는 호환 가능한 구조를 가지므로 타입 캐스트 또는 어댑터를 사용한다.

- [ ] **Step 2: ProfileHome.tsx 마이그레이션**

```ts
// SCM.get().usersLikeByNickname(q) 사용 확인 후 교체
import { userContainer } from "@/src/app/lib/supabaseClient";
const result = await userContainer.userService.searchUsersByNickname(q);
```

- [ ] **Step 3: UsersList.tsx (admin) 마이그레이션**

```ts
// 기존
const { data, error } = await SCM.get().allUser(sortField, isAsc);

// 신규
import { userContainer } from "@/src/app/lib/supabaseClient";
const result = await userContainer.userService.getAllUsers({ field: sortField, ascending: isAsc });
if (!result.success) { /* error */ return; }
const data = result.data;
```

- [ ] **Step 4: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 5: 커밋**

```bash
git add src/app/profile/ src/app/admin/users/
git commit -m "refactor: user 소비자 파일을 UserService/LogService로 마이그레이션"
```

---

## Task 7: ReleaseNote + Log 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/release-note/ReleaseNote.tsx`
- Modify: `src/app/word/logs/LogsHome.tsx`
- Modify: `src/app/admin/logs/AdminLogsHome.tsx`
- Modify: `src/app/admin/logs/AdminLogsWrapper.tsx`

- [ ] **Step 1: ReleaseNote.tsx 마이그레이션**

```ts
// 기존
import { SCM } from '../lib/supabaseClient';
const [internalResult, ...] = await Promise.allSettled([
    SCM.get().releaseNote(),
    ...
]);
if (internalResult.status === 'fulfilled') {
    const { data, error } = internalResult.value;
    if (error) { setErrorModalView({...}); }
    else { setNotes(data); }
}

// 신규
import { releaseNoteContainer } from '../lib/supabaseClient';
const [internalResult, ...] = await Promise.allSettled([
    releaseNoteContainer.service.getAll(),
    ...
]);
if (internalResult.status === 'fulfilled') {
    const result = internalResult.value;
    if (!result.success) { setErrorModalView({ ErrName: result.error.name, ErrMessage: result.error.message, ErrStackRace: '', inputValue: '릴리즈 노트' }); }
    else { setNotes(result.data.map(n => ({ id: n.id, title: n.title, content: n.content, created_at: n.createdAt, link: n.link }))); }
}
```

**Note:** ReleaseNote.tsx의 로컬 `Note` 타입과 `ReleaseNoteEntity`의 필드명이 다름 (snake_case vs camelCase). 위처럼 매핑한다.

- [ ] **Step 2: LogsHome.tsx 마이그레이션**

```ts
// 기존
import { SCM } from '@/src/app/lib/supabaseClient';
const { data: LogsData, error: LogsDataError, count } = await SCM.get().logsByFilter({ filterState, filterType, from, to });

// 신규
import { logContainer } from '@/src/app/lib/supabaseClient';
const logsResult = await logContainer.service.getWordLogsByFilter({ filterState, filterType, from, to });
if (!logsResult.success) {
    setErrorModalView({ ErrName: logsResult.error.name, ErrMessage: logsResult.error.message, ErrStackRace: null, inputValue: '/word/logs' });
    return;
}
const { data: LogsData, count } = logsResult.data;
```

**Note:** `LogsData`의 타입이 `WordLogEntity[]`이므로 LogsHome.tsx의 로컬 `LogItem` 인터페이스와 필드명이 다를 수 있다. `requestType` vs `r_type`, `madeBy` vs `make_by` 등을 매핑 함수로 변환하거나 로컬 인터페이스를 수정한다.

매핑 함수 예시:
```ts
function toLogItem(e: WordLogEntity): LogItem {
    return {
        id: e.id,
        word: e.word,
        state: e.state,
        r_type: e.requestType,
        make_by: e.madeBy,
        processed_by: e.processedBy,
        created_at: e.createdAt,
        make_by_user: e.madeByUser,
        processed_by_user: e.processedByUser,
    };
}
```

- [ ] **Step 3: AdminLogsHome.tsx 마이그레이션**

Word log 조회:
```ts
import { logContainer, docsContainer } from '@/src/app/lib/supabaseClient';
const result = await logContainer.service.getWordLogsByFilter({ filterState, filterType, from, to });
```

Docs log 조회 (이미 DocsQueryService에 구현됨):
```ts
const result = await docsContainer.queryService.getDocsLogsByFilter({ docsName, logType, from, to });
```

Word log 삭제:
```ts
// 기존
await SCM.delete().logsByIds(selectedIds);

// 신규
const result = await logContainer.service.deleteWordLogsByIds(selectedIds);
if (!result.success) { /* error */ }
```

Docs log 삭제:
```ts
// 기존
await SCM.delete().docsLogsByIds(selectedIds);

// 신규
const result = await logContainer.service.deleteDocsLogsByIds(selectedIds);
if (!result.success) { /* error */ }
```

- [ ] **Step 4: AdminLogsWrapper.tsx 마이그레이션**

SCM 사용 여부 확인 후 같은 패턴 적용.

- [ ] **Step 5: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: 커밋**

```bash
git add src/app/release-note/ src/app/word/logs/ src/app/admin/logs/
git commit -m "refactor: releaseNote, log 소비자 파일 마이그레이션"
```

---

## Task 8: Docs 소비자 파일 마이그레이션 (단순 파일)

**Files:**
- Modify: `src/app/words-docs/WordsDocsHome.tsx`
- Modify: `src/app/words-docs/WordsDocsHomePage.tsx`
- Modify: `src/app/words-docs/[id]/DocsDataPage.tsx`
- Modify: `src/app/words-docs/[id]/info/DocsInfoPage.tsx`
- Modify: `src/app/words-docs/[id]/logs/DocsLogPage.tsx`
- Modify: `src/app/admin/AdminPage.tsx`

**SCM → Service 매핑 (Docs):**

| 기존 (SCM) | 신규 |
|-----------|------|
| `SCM.get().allDocs()` | `docsContainer.queryService.getAllDocs()` |
| `SCM.get().docsInfo(id)` | `docsContainer.queryService.getDocsById(id)` |
| `SCM.get().docsLogs(id)` | `docsContainer.queryService.getDocsLogs(id)` |
| `SCM.get().docsLogsByFilter(filter)` | `docsContainer.queryService.getDocsLogsByFilter(filter)` |
| `SCM.get().docsWordCount(input)` | `docsContainer.queryService.getDocsWordCount(input)` |
| `SCM.get().docsViewRank(id)` | `docsContainer.queryService.getDocsViewRank(id)` |
| `SCM.get().docsStarCount(id)` | `docsContainer.queryService.getDocsStarCount(id)` |
| `SCM.get().docsStarUsers(id)` | `docsContainer.queryService.getDocsStarUsers(id)` |
| `SCM.update().docView(id)` | `docsContainer.commandService.incrementView(id)` |
| `SCM.add().starDocs(data)` | `docsContainer.commandService.addStarDocs(data)` |
| `SCM.delete().starDocs(data)` | `docsContainer.commandService.removeStarDocs(data)` |

**주의:** `DocsCommandService`의 정확한 메서드명을 확인 후 사용한다.

- [ ] **Step 1: WordsDocsHome.tsx 마이그레이션**

```ts
// 기존
import { SCM } from ...;
const { data, error } = await SCM.get().allDocs();

// 신규
import { docsContainer } from '@/src/app/lib/supabaseClient';
const result = await docsContainer.queryService.getAllDocs();
if (!result.success) { /* error */ return; }
const data = result.data;
```

- [ ] **Step 2: WordsDocsHomePage.tsx, DocsDataPage.tsx, DocsInfoPage.tsx 마이그레이션**

같은 패턴 적용. 각 파일에서 `SCM` import를 찾아 `docsContainer` (또는 해당 서비스)로 교체.

- [ ] **Step 3: DocsLogPage.tsx 마이그레이션**

```ts
// 기존
const { data, error } = await SCM.get().docsLogsByFilter({ docsName, logType, from, to });

// 신규
const result = await docsContainer.queryService.getDocsLogsByFilter({ docsName, logType, from, to });
if (!result.success) { /* error */ return; }
const { data: logsData, count } = result.data;
```

- [ ] **Step 4: AdminPage.tsx 마이그레이션**

AdminPage가 사용하는 SCM 메서드를 확인 후 해당 서비스로 교체. 주로 docs 관련 조회.

- [ ] **Step 5: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: 커밋**

```bash
git add src/app/words-docs/ src/app/admin/AdminPage.tsx
git commit -m "refactor: docs 단순 소비자 파일 마이그레이션"
```

---

## Task 9: Docs 복잡 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/words-docs/[id]/DocsDataHome.tsx`
- Modify: `src/app/words-docs/[id]/TableWorkFunc.tsx`
- Modify: `src/app/admin/request-docs/RequestDocsHome.tsx`
- Modify: `src/app/admin/request-docs/RequestDocsWrapper.tsx`

TableWorkFunc.tsx는 17개 이상의 SCM 메서드를 사용하는 가장 복잡한 파일이다.

**TableWorkFunc.tsx SCM → Service 매핑:**

| 기존 (SCM) | 신규 |
|-----------|------|
| 단어 추가/삭제 관련 Word 메서드들 | `wordContainer.commandService.*` |
| docs 정보 조회 | `docsContainer.queryService.*` |
| 대기 단어 처리 (approve/reject) | `wordContainer.commandService.acceptAddRequest` 등 |

- [ ] **Step 1: DocsDataHome.tsx 마이그레이션**

파일을 읽고 SCM 호출을 모두 파악한 뒤, `docsContainer` / `wordContainer`로 교체.

- [ ] **Step 2: TableWorkFunc.tsx 마이그레이션**

파일을 읽고 각 SCM 메서드를 분류:
- Docs 조회 → `docsContainer.queryService.*`
- Docs 명령 → `docsContainer.commandService.*`
- Word 명령 → `wordContainer.commandService.*`

Result 패턴으로 에러 처리 변환.

**주의:** 이 파일은 복잡도가 높으므로 마이그레이션 후 브라우저에서 단어 추가/삭제 기능을 수동 테스트한다.

- [ ] **Step 3: RequestDocsHome.tsx, RequestDocsWrapper.tsx 마이그레이션**

대기 단어장 조회/승인/거부 → `docsContainer.*` 사용.

```ts
// 대기 단어장 목록
const result = await docsContainer.queryService.getAllWaitDocs();
if (!result.success) { /* error */ return; }

// 승인
const result = await docsContainer.commandService.approveWaitDocs(id, processedBy);
```

**주의:** `DocsCommandService`에 `approveWaitDocs` 메서드가 있는지 확인한다. 없으면 Task 8 이전에 추가해야 한다.

- [ ] **Step 4: 타입 체크 + 수동 테스트**

```bash
npx tsc --noEmit
npm test
```

브라우저에서 `/words-docs` 페이지의 주요 기능 수동 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/words-docs/[id]/DocsDataHome.tsx src/app/words-docs/[id]/TableWorkFunc.tsx src/app/admin/request-docs/
git commit -m "refactor: docs 복잡 소비자 파일 마이그레이션 (TableWorkFunc 포함)"
```

---

## Task 10: Word 조회 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/word/lib.ts`
- Modify: `src/app/word/search/hooks/useWordSearch.ts`
- Modify: `src/app/word/search/[query]/SearchBar.tsx`
- Modify: `src/app/word/search/[query]/WordInfo.tsx`
- Modify: `src/app/word/search/[query]/WordInfoPage.tsx`
- Modify: `src/app/word/search/components/ThemeSelectionModal.tsx`
- Modify: `src/app/word/stats/WordStatsHome.tsx`
- Modify: `src/app/word/words-download/WordsDownloadHome.tsx`
- Modify: `src/app/word-combiner/WordCombinerPage.tsx`
- Modify: `src/app/api/words/search/route.ts`

**SCM → Service 매핑 (Word Query):**

| 기존 (SCM) | 신규 |
|-----------|------|
| `SCM.get().prefixWord(q)` | `wordContainer.queryService.searchByPrefix(q)` |
| `SCM.get().advancedSearch(input)` | `wordContainer.queryService.searchAdvanced(input)` |
| `SCM.get().wordInfoByWord(w)` | `wordContainer.queryService.getWordInfo(w)` |
| `SCM.get().wordsByWords(ws)` | `wordContainer.queryService.getWordsByWords(ws)` |
| `SCM.get().allThemes()` | `wordContainer.queryService.getAllThemes()` |
| `SCM.get().wordState()` | `wordContainer.queryService.getWordState()` |
| `SCM.get().wordsCount()` | `wordContainer.queryService.getWordsCount()` |
| `SCM.get().allWordsForCombiner()` | `wordContainer.queryService.getAllForCombiner()` |
| `SCM.get().allWords(filter)` | `wordContainer.queryService.getAllForDownload(filter)` |
| `SCM.get().letterCountInfo()` | `wordContainer.queryService.getLetterCounts()` |
| `SCM.get().waitWordByWord(w)` | `wordContainer.queryService.getWaitWordInfo(w)` |
| `SCM.get().waitWords()` | `wordContainer.queryService.getAllWaitWords()` |

- [ ] **Step 1: word/lib.ts 마이그레이션**

`word/lib.ts`는 여러 페이지에서 import되는 공유 유틸이다. 파일을 읽고 SCM 의존성을 `wordContainer` 의존성으로 교체.

```ts
import { wordContainer } from '@/src/app/lib/supabaseClient';
```

- [ ] **Step 2: useWordSearch.ts 마이그레이션**

```ts
// 기존
const { data, error } = await SCM.get().prefixWord(query);

// 신규
const result = await wordContainer.queryService.searchByPrefix(query);
if (!result.success) { /* error */ return; }
const data = result.data;
```

- [ ] **Step 3: SearchBar.tsx, WordInfo.tsx, WordInfoPage.tsx 마이그레이션**

각 파일의 SCM 호출을 파악 후 `wordContainer.queryService.*` 로 교체.

**ThemeSelectionModal.tsx:**
```ts
const result = await wordContainer.queryService.getAllThemes();
if (!result.success) { /* error */ return; }
const themes = result.data;
```

- [ ] **Step 4: WordStatsHome.tsx 마이그레이션**

```ts
// 기존
const { data, error } = await SCM.get().wordState();

// 신규
const result = await wordContainer.queryService.getWordState();
if (!result.success) { /* error */ return; }
const { firstLetterCounts, lastLetterCounts } = result.data;
```

- [ ] **Step 5: WordsDownloadHome.tsx, WordCombinerPage.tsx 마이그레이션**

```ts
// WordsDownloadHome
const result = await wordContainer.queryService.getAllForDownload(filter);

// WordCombinerPage
const result = await wordContainer.queryService.getAllForCombiner();
```

- [ ] **Step 6: api/words/search/route.ts 마이그레이션 (서버 사이드)**

API 라우트는 브라우저 Supabase 클라이언트를 사용할 수 없다. 서버 클라이언트를 사용해야 한다.

파일을 읽어 현재 supabase 클라이언트 import 확인. 서버 클라이언트 기반으로 컨테이너를 생성:

```ts
import { createClient } from '@supabase/ssr';
import { WordServiceContainer } from '@/src/lib/services/WordServiceContainer';
import { SupabaseWordRepository } from '@/src/lib/services/infrastructure/supabase/SupabaseWordRepository';
// ...

// 라우트 핸들러 내에서
const supabaseServer = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: ... }  // 서버 컨텍스트
);
const wordRepo = new SupabaseWordRepository(supabaseServer);
// 필요한 repo만 직접 생성하여 사용
const result = await wordRepo.findByPrefix(query);
```

**주의:** 서버 라우트에서 전체 컨테이너 대신 필요한 레포지토리만 직접 생성하는 것이 권장된다.

- [ ] **Step 7: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 8: 커밋**

```bash
git add src/app/word/lib.ts src/app/word/search/ src/app/word/stats/ src/app/word/words-download/ src/app/word-combiner/ src/app/api/
git commit -m "refactor: word 조회 소비자 파일을 WordQueryService로 마이그레이션"
```

---

## Task 11: Word 명령 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/word/add/WordAddHome.tsx`
- Modify: `src/app/word/adds/WordsAddHome.tsx`
- Modify: `src/app/word/requests/RequestsHome.tsx`

**SCM → Service 매핑 (Word Command):**

| 기존 (SCM) | 신규 |
|-----------|------|
| `SCM.add().waitWord(data)` (단어 삭제 요청) | `wordContainer.commandService.requestDelete(word, userId)` |
| `SCM.add().waitWords(data)` (bulk) | `wordContainer.commandService.addWordsBulk(words, themes, addedBy)` |
| `SCM.add().waitWordTheme(data)` | `wordContainer.commandService.*` 내부에서 처리됨 |
| `SCM.delete().waitWordByWord(w)` | `wordContainer.commandService.*` 내부에서 처리됨 |

- [ ] **Step 1: WordAddHome.tsx 마이그레이션**

단어 추가 요청 (`wait_words` insert):
```ts
// 신규
const result = await wordContainer.commandService.requestAdd(word, themes, userId);
```

**주의:** `WordCommandService.requestAdd` 메서드가 있는지 확인한다. Phase 1 계획에는 `addWord` (직접 추가, 어드민용)와 `addWordsBulk`가 있었으나, 일반 사용자의 대기 요청 추가는 별도 메서드일 수 있다. 없으면 `WordCommandService`에 `requestAddWord(word, themes, requestedBy)` 메서드를 추가한다.

- [ ] **Step 2: WordsAddHome.tsx 마이그레이션**

여러 단어 대기 요청:
```ts
const result = await wordContainer.commandService.addWordsBulk(words, themes, userId);
if (!result.success) { /* error */ return; }
```

- [ ] **Step 3: RequestsHome.tsx 마이그레이션**

사용자의 대기 요청 목록 조회:
```ts
// 기존: SCM.get().waitWords('add')
const result = await wordContainer.queryService.getAllWaitWords('add');
```

- [ ] **Step 4: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 5: 커밋**

```bash
git add src/app/word/add/ src/app/word/adds/ src/app/word/requests/
git commit -m "refactor: word 사용자 명령 소비자 파일 마이그레이션"
```

---

## Task 12: 관리자 Word 소비자 파일 마이그레이션

**Files:**
- Modify: `src/app/admin/add-words/AddWordsHome.tsx`
- Modify: `src/app/admin/del-words/DelWordsHome.tsx`
- Modify: `src/app/admin/request-words/AdminRequestHome.tsx`
- Modify: `src/app/admin/request-words/AdminWrapper.tsx`
- Modify: `src/app/admin/request-words/ThemeSelectModal.tsx`
- Modify: `src/app/admin/api-server/api.ts`

**SCM → Service 매핑 (Admin Word Command):**

| 기존 (SCM) | 신규 |
|-----------|------|
| 대기 단어 승인 (add) | `wordContainer.commandService.acceptAddRequest(waitWordId, processedBy)` |
| 대기 단어 거부 (add) | `wordContainer.commandService.rejectAddRequest(waitWordId, processedBy)` |
| 대기 단어 승인 (delete) | `wordContainer.commandService.acceptDeleteRequest(waitWordId, processedBy)` |
| 대기 단어 거부 (delete) | `wordContainer.commandService.rejectDeleteRequest(waitWordId, processedBy)` |
| 어드민 직접 삭제 | `wordContainer.commandService.deleteByAdmin(wordId, processedBy)` |
| 전체 대기 목록 조회 | `wordContainer.queryService.getAllWaitWords()` |
| 대기 테마 조회 | `wordContainer.queryService.getAllWaitThemes()` |
| 테마 목록 | `wordContainer.queryService.getAllThemes()` |

- [ ] **Step 1: AddWordsHome.tsx 마이그레이션**

```ts
import { wordContainer } from '@/src/app/lib/supabaseClient';

// 대기 목록 조회
const result = await wordContainer.queryService.getAllWaitWords('add');
if (!result.success) { /* error */ return; }

// 승인
const result = await wordContainer.commandService.acceptAddRequest(waitWordId, processedBy);
if (!result.success) { /* error */ return; }
```

- [ ] **Step 2: DelWordsHome.tsx 마이그레이션**

같은 패턴, delete 관련 메서드 사용.

- [ ] **Step 3: AdminRequestHome.tsx, AdminWrapper.tsx 마이그레이션**

```ts
const result = await wordContainer.queryService.getAllWaitWords();
const resultThemes = await wordContainer.queryService.getAllWaitThemes();
```

- [ ] **Step 4: ThemeSelectModal.tsx 마이그레이션**

```ts
const result = await wordContainer.queryService.getAllThemes();
```

- [ ] **Step 5: admin/api-server/api.ts 마이그레이션 (서버 사이드)**

파일을 읽어 현재 구조 파악. API 서버 파일이면 서버 Supabase 클라이언트를 기반으로 레포지토리를 직접 생성하여 사용.

- [ ] **Step 6: 타입 체크 + 테스트**

```bash
npx tsc --noEmit
npm test
```

브라우저에서 `/admin/add-words`, `/admin/del-words` 수동 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/app/admin/add-words/ src/app/admin/del-words/ src/app/admin/request-words/ src/app/admin/api-server/
git commit -m "refactor: admin word 소비자 파일을 WordCommandService로 마이그레이션"
```

---

## Task 13: 최종 정리 — SCM 제거

**Files:**
- Modify: `src/app/lib/supabaseClient.ts` — SCM export 제거
- Delete: `src/app/lib/supabase/SupabaseClientManager.ts`
- Delete: `src/app/lib/supabase/ISupabaseClientManager.ts` (존재하는 경우)

**전제 조건:** Task 4–12가 모두 완료되어 SCM을 참조하는 소비자가 0개여야 한다.

- [ ] **Step 1: 잔여 SCM 참조 확인**

```bash
grep -r "SCM\." src/app --include="*.ts" --include="*.tsx" -l
```
Expected: 빈 결과 (아무 파일도 나오지 않아야 함)

- [ ] **Step 2: supabaseClient.ts에서 SCM 관련 코드 제거**

제거할 항목:
```ts
// 이 줄들을 제거
import { SupabaseClientManager } from './supabase/SupabaseClientManager';
export const SCM = new SupabaseClientManager(supabase);
```

- [ ] **Step 3: SupabaseClientManager.ts 삭제**

```bash
rm src/app/lib/supabase/SupabaseClientManager.ts
```

ISupabaseClientManager.ts가 별도 파일로 존재하는 경우도 삭제:
```bash
ls src/app/lib/supabase/
```

- [ ] **Step 4: 타입 체크 + 전체 테스트**

```bash
npx tsc --noEmit
npm test
npm run build
```
Expected: 에러 없음, 모든 테스트 통과, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/app/lib/supabaseClient.ts
git rm src/app/lib/supabase/SupabaseClientManager.ts
git commit -m "feat: SupabaseClientManager 제거 및 SCM 싱글톤 완전 이관 완료"
```

---

## Self-Review

### Spec 커버리지 체크

| db_refactor.md Phase 4 요구사항 | 구현 태스크 |
|--------------------------------|-----------|
| 기존 SupabaseClientManager 제거 | Task 13 |
| ISupabaseClientManager 인터페이스 제거 | Task 13 |
| SCM 싱글톤을 도메인별 서비스 싱글톤으로 교체 | Task 3 |
| Log 도메인 미구현 | Task 1 |
| ReleaseNote 미구현 | Task 2 |
| 43개 소비자 파일 마이그레이션 | Task 4–12 |

### 주요 리스크 및 주의사항

1. **Result<T,E> 패턴 변환**: 모든 마이그레이션에서 `{ data, error }` → `result.success / result.data` 패턴 변환 필요
2. **onAuthStateChange 구조 변환**: `{ data: { subscription: { unsubscribe } } }` → `{ unsubscribe: () => void }` (Task 5)
3. **setNickname 이후 사용자 데이터 조회**: setNickname이 `void`를 반환하므로 getUserById 추가 호출 필요 (Task 5)
4. **camelCase vs snake_case 매핑**: 도메인 엔티티 필드명이 camelCase이므로 소비자 컴포넌트의 로컬 타입과 불일치 가능
5. **서버 사이드 파일**: API 라우트는 브라우저 싱글톤 대신 레포지토리를 직접 생성해야 함
6. **TableWorkFunc.tsx**: 가장 복잡한 파일, 마이그레이션 후 수동 테스트 필수
7. **DocsCommandService 메서드 확인**: approveWaitDocs 등 일부 메서드가 구현되지 않았을 수 있으므로, 소비자 마이그레이션 전 해당 메서드 존재 여부 확인 후 없으면 추가
8. **WordCommandService.requestAddWord**: 일반 사용자의 단어 추가 요청(wait_words insert) 메서드가 없을 수 있음 — Task 11 전에 확인 및 추가 필요

### 타입 체크 포인트

각 Task의 `npx tsc --noEmit` 단계에서 에러가 발생하면:
- 메서드명 오타 확인
- Result<T,E> 언래핑 확인
- 엔티티 필드명 매핑 확인
