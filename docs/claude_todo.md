# Docs 도메인 리팩터링 플랜 (Phase 2-A)

## Context

`SupabaseClientManager`에 산재한 Docs 관련 메서드(19개)를 Word 도메인과 동일한 DDD-Lite 패턴으로 분리한다. Strangler Fig 방식으로 기존 SCM을 건드리지 않고 새 레이어를 생성한 뒤, `WordServiceContainer`의 `SupabaseDocsLogWriter` 임시 구현체(Phase 2 교체 예정으로 주석 달린)만 `DocsCommandService`로 교체한다. 소비자 코드 이관은 별도 PR.

**설계 문서:** `docs/superpowers/specs/2026-04-29-docs-domain-design.md`

---

## 구현 순서 및 파일 목록

### Step 1: errors.ts에 Docs 에러 추가
**파일:** `src/lib/services/domain/errors.ts`  
`waitWordNotFoundError` 아래에 추가. 기존 `createDomainError` 패턴 그대로.

```ts
export function docsNotFoundError(identifier: string | number): CustomError {
    return createDomainError('DocsNotFoundError', `문서 '${identifier}'를 찾을 수 없습니다.`, 404, { code: 'DOCS_NOT_FOUND' });
}

export function waitDocsNotFoundError(identifier: string | number): CustomError {
    return createDomainError('WaitDocsNotFoundError', `대기 문서 '${identifier}'를 찾을 수 없습니다.`, 404, { code: 'WAIT_DOCS_NOT_FOUND' });
}
```

---

### Step 2: Domain Layer — 새 파일 3개 + index

**`src/lib/services/domain/docs/DocsEntity.ts`** — 엔티티 및 타입 정의

```ts
// docs 테이블
interface DocsEntity { id, name, typez: 'letter'|'theme'|'ect', maker, duem, isHidden, views, createdAt, lastUpdate }
interface DocsWithUser extends DocsEntity { userNickname: string | null }

// docs_logs 테이블
interface DocsLogEntity { id, docsId, word, type: 'add'|'delete', addBy, date }
interface DocsLogWithUser extends DocsLogEntity { userNickname: string | null }

// docs_wait 테이블
interface WaitDocsEntity { id, docsName, reqBy, reqAt }
interface WaitDocsWithUser extends WaitDocsEntity { userNickname: string | null }

// 조합 결과 타입
interface DocsLogsFilterResult { logs: DocsLogWithUser[]; count: number }
interface DocsWordsResult { words: DocsWordItem[]; waitWords: DocsWaitWordItem[] }
interface DocsWordItem { id, word, length, firstLetter, lastLetter, noinCanuse, kCanuse, missionMark, chosungs, addedBy, addedAt }
interface DocsWaitWordItem { word, requestedBy: string|null, requestType: 'add'|'delete' }

// 입력 타입
type DocsWordsQuery =
  | { name: string; duem: boolean; typez: 'letter' | 'theme' }
  | { name: number; duem: boolean; typez: 'ect' }
interface NewDocs { name, maker, duem, typez }
interface NewDocsLog { docsId, word, type: 'add'|'delete', addBy }
interface DocsLogsFilter { docsName?, logType: 'add'|'delete'|'all', from, to }
```

**`src/lib/services/domain/docs/DocsRepository.ts`** — IDocsRepository 인터페이스

| 메서드 | SCM 원본 | 반환 |
|--------|---------|------|
| `findAll()` | `allDocs()` | `DocsWithUser[]` |
| `findById(id)` | `docsInfoByDocsId(id)` | `DocsWithUser \| null` |
| `findLetterDocs()` | `letterDocs()` | `DocsEntity[]` |
| `findThemeDocsByNames(names)` | `themeDocsByThemeNames(names)` | `DocsEntity[]` |
| `findLastUpdate(id)` | `docsLastUpdate(id)` (GetManager) | `string \| null` |
| `findViewRank(id)` | `docsVeiwRankByDocsId(id)` | `number` |
| `findStarCount(id)` | `docsStarCount(id)` | `number` |
| `findStarUserIds(id)` | `docsStar(id)` | `string[]` |
| `findLogs(id)` | `docsLogs(id)` | `DocsLogWithUser[]` |
| `findLogsByFilter(filter)` | `docsLogsByFilter(...)` | `DocsLogsFilterResult` |
| `findWordCount(query)` | `docsWordCount(...)` | `number` |
| `findWords(query)` | `docsWords(...)` | `DocsWordsResult` |
| `save(docs[])` | `docs(insertQuery[])` | `DocsEntity[]` |
| `saveLog(logs[])` | `docsLog(logsData[])` | `void` |
| `saveStar(docsId, userId)` | `starDocs(...)` | `void` |
| `deleteStar(docsId, userId)` | `startDocs(...)` (주의: delete) | `void` |
| `deleteLogsByIds(ids[])` | `docsLogsByIds(ids[])` | `void` |
| `updateLastUpdate(docsIds[])` | `docsLastUpdate(ids[])` (UpdateManager) | `void` |
| `incrementViews(id)` | `docView(id)` | `void` |

**`src/lib/services/domain/docs/WaitDocsRepository.ts`** — IWaitDocsRepository (3개 메서드)

```ts
interface IWaitDocsRepository {
  findAll(): Promise<Result<WaitDocsWithUser[], CustomError>>
  save(docsName: string, reqBy: string | null): Promise<Result<WaitDocsEntity, CustomError>>
  deleteByIds(ids: number[]): Promise<Result<void, CustomError>>
}
```

**`src/lib/services/domain/docs/index.ts`** — 전체 re-export

---

### Step 3: Infrastructure Layer — 새 파일 2개

**`src/lib/services/infrastructure/supabase/SupabaseDocsRepository.ts`**

```ts
type DocsRow = Database['public']['Tables']['docs']['Row']
type DocsLogRow = Database['public']['Tables']['docs_logs']['Row']

function toDocsEntity(row: DocsRow): DocsEntity { /* snake_case → camelCase 매핑 */ }
function toDocsLogEntity(row: DocsLogRow): DocsLogEntity { /* 매핑 */ }

export class SupabaseDocsRepository implements IDocsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}
  // 각 메서드: Supabase 쿼리 → if(error) failure(infrastructureError(error)) → success(mapped)
}
```

**주요 구현 노트:**

- `findAll()`: 기존 `SupabaseDocsLogWriter.getAllDocs()`와 동일하되 `is_hidden` 필터 추가, 전체 필드 반환.  
  `is_hidden` 프로덕션 필터: `if (process.env.NODE_ENV === 'production') q = q.eq('is_hidden', false)`
- `findLogsByFilter()`: `docs_logs` 조인 컬럼 필터 `'docs.name'` 사용. SCM 로직 그대로 포팅.
- `findWordCount()` — 3가지 분기:
  - `letter`: `word_last_letter_counts` 테이블, `duem=true`이면 `reverDuemLaw()` 후 `.in('last_letter', letters)`, 합산
  - `theme`: `themes` 테이블에서 id 조회 → `word_themes` count
  - `ect`: `201|202` → `words` where `k_canuse=true AND length>8` count; 나머지는 0 반환
- `findWords()` — 3가지 분기 (SCM `docsWords()` 165줄 포팅):
  - `letter`: `duem=true`이면 `reverDuemLaw()` 결과로 `words` `.in('last_letter', ...)` + `wait_words` 루프 `.ilike()` 체이닝
  - `theme`: themes id 조회 → `rpc('get_words_by_theme')` + `word_themes_wait` + `wait_word_themes` + `rpc('get_delete_requests_by_themeid')` 조합, Set 중복 제거
  - `ect`: `201|202` → `k_canuse=true AND length>8` + `rpc('get_long_wait_words_data')`, `209-237` → `rpc('get_mission_words')` 그룹핑, `239-252` → `rpc('get_mission_len3_words')`
  - **import**: `reverDuemLaw` from `@/src/lib/hangulUtils`, `misssionCharMask` from `@/src/app/lib/lib` (SCM과 동일)

**`src/lib/services/infrastructure/supabase/SupabaseWaitDocsRepository.ts`**

```ts
export class SupabaseWaitDocsRepository implements IWaitDocsRepository {
  // findAll: docs_wait with users(*) join
  // save: insert + select single → WaitDocsEntity
  // deleteByIds: delete .in('id', ids)
}
```

**`src/lib/services/infrastructure/supabase/index.ts`** — 기존 파일에 두 줄 추가:
```ts
export { SupabaseDocsRepository } from './SupabaseDocsRepository';
export { SupabaseWaitDocsRepository } from './SupabaseWaitDocsRepository';
```

---

### Step 4: Application Layer — 새 파일 3개

**`src/lib/services/application/docs/DocsQueryService.ts`**

```ts
export class DocsQueryService {
  constructor(
    private readonly docsRepo: IDocsRepository,
    private readonly waitDocsRepo: IWaitDocsRepository,
  ) {}
  // 모든 메서드: 단순 this.docsRepo.findXxx() 또는 this.waitDocsRepo.findXxx() 위임
  // Word의 2초 딜레이 불필요 (검색이 아닌 조회)
}
```

메서드 목록: `getAllDocs`, `getDocsById`, `getLetterDocs`, `getThemeDocsByNames`, `getDocsLastUpdate`, `getDocsViewRank`, `getDocsStarCount`, `getDocsStarUserIds`, `getDocsLogs`, `getDocsLogsByFilter`, `getDocsWordCount`, `getDocsWords`, `getAllWaitDocs`

**`src/lib/services/application/docs/DocsCommandService.ts`**

`IDocsLogWriter`를 구현하여 `WordCommandService`에 주입 가능하게 함.

```ts
import type { IDocsLogWriter } from '../word/WordCommandService';

export class DocsCommandService implements IDocsLogWriter {
  constructor(
    private readonly docsRepo: IDocsRepository,
    private readonly waitDocsRepo: IWaitDocsRepository,
  ) {}

  // IDocsLogWriter 구현:
  async writeDocsLog(logsData: {word,docs_id,add_by,type}[]): Promise<void>
    // snake_case → camelCase 매핑 후 docsRepo.saveLog() 호출
  async getAllDocs(): Promise<{id,name,typez}[]>
    // docsRepo.findAll() 실패 시 [] 반환 (에러 전파 안 함 — WordCommandService의 IDocsLogWriter 계약)
  async updateDocsLastUpdate(docsIds: number[]): Promise<void>
    // docsRepo.updateLastUpdate() 호출

  // Docs 커맨드:
  async createDocs(docs: NewDocs[]): Promise<Result<DocsEntity[], CustomError>>
  async addStar(docsId, userId): Promise<Result<void, CustomError>>
  async removeStar(docsId, userId): Promise<Result<void, CustomError>>
  async requestWaitDocs(docsName, reqBy): Promise<Result<WaitDocsEntity, CustomError>>
  async approveWaitDocs(ids): Promise<Result<void, CustomError>>
  async deleteDocsLogs(ids): Promise<Result<void, CustomError>>
  async incrementDocViews(id): Promise<Result<void, CustomError>>
}
```

**`src/lib/services/application/docs/index.ts`**
```ts
export { DocsQueryService } from './DocsQueryService';
export { DocsCommandService } from './DocsCommandService';
```

---

### Step 5: Container — 새 파일 1개

**`src/lib/services/DocsServiceContainer.ts`**

```ts
export class DocsServiceContainer {
  public readonly docsRepo: IDocsRepository;
  public readonly waitDocsRepo: IWaitDocsRepository;
  public readonly queryService: DocsQueryService;
  public readonly commandService: DocsCommandService;  // 즉시 초기화 (순환 의존 없음)

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.docsRepo = new SupabaseDocsRepository(supabase);
    this.waitDocsRepo = new SupabaseWaitDocsRepository(supabase);
    this.queryService = new DocsQueryService(this.docsRepo, this.waitDocsRepo);
    this.commandService = new DocsCommandService(this.docsRepo, this.waitDocsRepo);
  }
}

export function createDocsServiceContainer(supabase): DocsServiceContainer {
  return new DocsServiceContainer(supabase);
}
```

---

### Step 6: WordServiceContainer.ts 업데이트

**파일:** `src/lib/services/WordServiceContainer.ts`

`createWordServiceContainer()` 내에서 `SupabaseDocsLogWriter` → `DocsCommandService`로 교체:

```ts
// 추가 import
import { createDocsServiceContainer } from './DocsServiceContainer';

export function createWordServiceContainer(supabase: SupabaseClient<Database>): WordServiceContainer {
  const container = new WordServiceContainer(supabase);

  const docsContainer = createDocsServiceContainer(supabase);        // 추가
  const docsLogWriter = docsContainer.commandService;                 // 변경 (기존: new SupabaseDocsLogWriter(supabase))
  const wordLogWriter = new SupabaseWordLogWriter(supabase);
  const userContributionUpdater = new SupabaseUserContributionUpdater(supabase);

  container.initCommandService(docsLogWriter, wordLogWriter, userContributionUpdater);
  return container;
}
```

`SupabaseDocsLogWriter` 클래스는 기존 소비자 호환성을 위해 파일에 유지 (삭제 금지).

---

### Step 7: 테스트 파일

**`src/__tests__/lib/services/domain/errors.test.ts`** — 기존 파일에 추가

기존 import에 `docsNotFoundError`, `waitDocsNotFoundError` 추가. 각 2개 테스트 케이스(string/number 식별자).

**`src/__tests__/lib/services/application/docs/DocsQueryService.test.ts`** — 신규

패턴: `WordQueryService.test.ts`와 동일.
- `createMockDocsRepo()`: IDocsRepository의 모든 메서드를 `jest.fn()`으로
- `createMockWaitDocsRepo()`: IWaitDocsRepository의 3개 메서드
- 각 메서드별 `describe` — 성공 케이스 + infrastructure error 전파 케이스

커버 범위: `getAllDocs`, `getDocsById`, `getLetterDocs`, `getThemeDocsByNames`, `getDocsLastUpdate`, `getDocsViewRank`, `getDocsStarCount`, `getDocsStarUserIds`, `getDocsLogs`, `getDocsLogsByFilter`, `getDocsWordCount(letter/theme/ect)`, `getDocsWords`, `getAllWaitDocs`

**`src/__tests__/lib/services/application/docs/DocsCommandService.test.ts`** — 신규

패턴: `WordCommandService.test.ts`와 동일.

중점 커버 항목:
- `writeDocsLog`: snake_case 입력 → camelCase로 `saveLog` 호출 확인
- `getAllDocs`: `findAll` 성공 → `{id,name,typez}[]` 반환; 실패 → `[]` 반환 (에러 전파 없음)
- `updateDocsLastUpdate`: `updateLastUpdate` 위임 확인
- `addStar` / `removeStar`: 성공 + 에러 케이스
- `requestWaitDocs`: `waitDocsRepo.save` 위임
- `approveWaitDocs`: `waitDocsRepo.deleteByIds` 위임
- `deleteDocsLogs`: `docsRepo.deleteLogsByIds` 위임
- `incrementDocViews`: `docsRepo.incrementViews` 위임

---

## 의존성 순서 (의존성 기준 정렬)

1. `domain/errors.ts` ← 의존 없음
2. `domain/docs/DocsEntity.ts` ← 의존 없음
3. `domain/docs/DocsRepository.ts` ← DocsEntity
4. `domain/docs/WaitDocsRepository.ts` ← DocsEntity
5. `domain/docs/index.ts` ← 2,3,4
6. `infrastructure/supabase/SupabaseDocsRepository.ts` ← 2,3
7. `infrastructure/supabase/SupabaseWaitDocsRepository.ts` ← 2,4
8. `infrastructure/supabase/index.ts` ← 6,7 (기존 파일 수정)
9. `application/docs/DocsQueryService.ts` ← 3,4,5
10. `application/docs/DocsCommandService.ts` ← 3,4,5 + IDocsLogWriter (WordCommandService)
11. `application/docs/index.ts` ← 9,10
12. `DocsServiceContainer.ts` ← 6,7,9,10
13. `WordServiceContainer.ts` ← 12 (기존 파일 수정)
14. `errors.test.ts` ← 1 (기존 파일 수정)
15. `DocsQueryService.test.ts` ← 9,3,4
16. `DocsCommandService.test.ts` ← 10,3,4

---

## 참조 파일 (구현 시 참고)

- `src/lib/services/domain/errors.ts` — `createDomainError` 패턴
- `src/lib/services/domain/word/WordEntity.ts` — 엔티티 구조 패턴
- `src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts` — Row 매퍼 + Result 패턴
- `src/lib/services/infrastructure/supabase/SupabaseWaitWordRepository.ts` — Wait 레포 패턴
- `src/lib/services/application/word/WordCommandService.ts` — `IDocsLogWriter` 정확한 시그니처 (line 14-21)
- `src/lib/services/WordServiceContainer.ts` — `SupabaseDocsLogWriter` 교체 대상 위치 (line 146)
- `src/app/lib/supabase/SupabaseClientManager.ts` — `docsWords()` (line 161-326), `docsWordCount()` (line 115-140)
- `src/__tests__/lib/services/application/word/WordQueryService.test.ts` — 테스트 패턴
- `src/__tests__/lib/services/application/word/WordCommandService.test.ts` — 테스트 패턴

---

## 검증

```bash
npx tsc --noEmit        # 타입 에러 없음 확인
npm run test            # 기존 85개 + 신규 테스트 전부 통과 확인
npm run lint            # ESLint 경고 없음
```

수동 확인: `createWordServiceContainer`가 `DocsCommandService`를 `IDocsLogWriter`로 올바르게 주입하는지 `WordServiceContainer.test.ts` 실행으로 확인.
