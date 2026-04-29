# Docs 도메인 리팩터링 설계

**날짜:** 2026-04-29  
**범위:** Phase 2-A (Docs 도메인만, Log 도메인 제외)  
**전략:** Strangler Fig — 기존 SCM과 공존하며 점진적 이관

---

## 배경

현재 `SupabaseClientManager`의 `GetManager`/`AddManager`/`DeleteManager`/`UpdateManager`에 Docs 관련 메서드가 산재해 있다. Word 도메인(Phase 1)과 동일한 DDD-Lite 패턴으로 분리한다.

---

## 디렉토리 구조

```
src/lib/services/
├── domain/
│   └── docs/
│       ├── DocsEntity.ts          # 엔티티 + 타입 정의
│       ├── DocsRepository.ts      # IDocsRepository 인터페이스
│       └── WaitDocsRepository.ts  # IWaitDocsRepository 인터페이스
│
├── application/
│   └── docs/
│       ├── DocsQueryService.ts
│       ├── DocsCommandService.ts
│       └── index.ts
│
├── infrastructure/
│   └── supabase/
│       ├── SupabaseDocsRepository.ts
│       └── SupabaseWaitDocsRepository.ts
│
└── DocsServiceContainer.ts
```

---

## Domain Layer

### DocsEntity.ts

```ts
interface DocsEntity {
  id: number
  name: string
  typez: 'letter' | 'theme'
  maker: string | null
  duem: boolean
  isHidden: boolean
  views: number
  createdAt: string
  lastUpdate: string
}

interface DocsWithUser extends DocsEntity {
  userNickname: string | null
}

interface DocsLogEntity {
  id: number
  docsId: number
  word: string
  type: 'add' | 'delete'
  addBy: string | null
  date: string
}

interface DocsLogWithDocs extends DocsLogEntity {
  docsName: string
}

interface WaitDocsEntity {
  id: number
  docsName: string
  reqBy: string | null
  reqAt: string
}

interface WaitDocsWithUser extends WaitDocsEntity {
  userNickname: string | null
}

interface StarDocsEntity {
  id: number
  userId: string
  docsId: number
  createdAt: string
}

interface NewDocs {
  name: string
  maker: string | null
  duem: boolean
  typez: 'letter'
}

interface NewDocsLog {
  docsId: number
  word: string
  type: 'add' | 'delete'
  addBy: string | null
}

interface DocsLogFilter {
  docsName?: string
  logType: 'add' | 'delete' | 'all'
  from: number
  to: number
}

// docsWordCount에 사용되는 입력 타입
type DocsWordCountInput =
  | { name: string; duem: boolean; typez: 'letter' | 'theme' }
  | { name: number; duem: boolean; typez: 'ect' }
```

### IDocsRepository (docs + docs_logs + user_star_docs)

```ts
interface IDocsRepository {
  // 조회
  findAll(): Promise<Result<DocsWithUser[], CustomError>>
  findById(id: number): Promise<Result<DocsWithUser | null, CustomError>>
  findByType(typez: 'letter' | 'theme'): Promise<Result<DocsEntity[], CustomError>>
  findByThemeNames(names: string[]): Promise<Result<DocsEntity[], CustomError>>
  findLastUpdate(id: number): Promise<Result<string | null, CustomError>>
  findWordCount(input: DocsWordCountInput): Promise<Result<number, CustomError>>
  findViewRank(id: number): Promise<Result<unknown, CustomError>>
  findStarCount(id: number): Promise<Result<number, CustomError>>
  findStarUsers(id: number): Promise<Result<string[], CustomError>>

  // 로그
  findLogs(docsId: number): Promise<Result<DocsLogEntity[], CustomError>>
  findLogsByFilter(filter: DocsLogFilter): Promise<Result<{ data: DocsLogWithDocs[]; count: number }, CustomError>>
  saveLogs(logs: NewDocsLog[]): Promise<Result<void, CustomError>>
  deleteLogsByIds(ids: number[]): Promise<Result<void, CustomError>>

  // star
  saveStar(docsId: number, userId: string): Promise<Result<void, CustomError>>
  deleteStar(docsId: number, userId: string): Promise<Result<void, CustomError>>

  // 쓰기
  save(docs: NewDocs[]): Promise<Result<DocsEntity[], CustomError>>
  updateLastUpdate(docsIds: number[]): Promise<Result<void, CustomError>>
  incrementView(id: number): Promise<Result<void, CustomError>>
}
```

### IWaitDocsRepository (docs_wait)

```ts
interface IWaitDocsRepository {
  findAll(): Promise<Result<WaitDocsWithUser[], CustomError>>
  save(docsName: string, reqBy: string | null): Promise<Result<void, CustomError>>
  deleteByIds(ids: number[]): Promise<Result<void, CustomError>>
}
```

---

## Application Layer

### DocsQueryService

읽기 전용 유즈케이스. 레이트 리미팅 불필요 (검색이 아닌 조회).

```ts
class DocsQueryService {
  constructor(docsRepo: IDocsRepository, waitDocsRepo: IWaitDocsRepository)

  getAllDocs(): Promise<Result<DocsWithUser[], CustomError>>
  getDocsById(id: number): Promise<Result<DocsWithUser | null, CustomError>>
  getLetterDocs(): Promise<Result<DocsEntity[], CustomError>>
  getDocsByThemeNames(names: string[]): Promise<Result<DocsEntity[], CustomError>>
  getDocsWordCount(input: DocsWordCountInput): Promise<Result<number, CustomError>>
  getDocsViewRank(id: number): Promise<Result<unknown, CustomError>>
  getDocsStarCount(id: number): Promise<Result<number, CustomError>>
  getDocsStarUsers(id: number): Promise<Result<string[], CustomError>>
  getDocsLogs(docsId: number): Promise<Result<DocsLogEntity[], CustomError>>
  getDocsLogsByFilter(filter: DocsLogFilter): Promise<Result<{ data: DocsLogWithDocs[]; count: number }, CustomError>>
  getAllWaitDocs(): Promise<Result<WaitDocsWithUser[], CustomError>>
}
```

### DocsCommandService

쓰기 유즈케이스. `IDocsLogWriter`를 구현하여 `WordCommandService`에 주입 가능.

```ts
class DocsCommandService implements IDocsLogWriter {
  constructor(docsRepo: IDocsRepository, waitDocsRepo: IWaitDocsRepository)

  // IDocsLogWriter 구현 (WordCommandService가 사용)
  async writeDocsLog(logs: NewDocsLog[]): Promise<void>
  async getAllDocs(): Promise<{ id: number; name: string; typez: string }[]>
  async updateDocsLastUpdate(docsIds: number[]): Promise<void>

  // 커맨드
  async addStar(docsId: number, userId: string): Promise<Result<void, CustomError>>
  async removeStar(docsId: number, userId: string): Promise<Result<void, CustomError>>
  async requestDocs(docsName: string, userId: string | null): Promise<Result<void, CustomError>>
  async approveWaitDocs(ids: number[]): Promise<Result<void, CustomError>>
  async deleteDocsLogs(ids: number[]): Promise<Result<void, CustomError>>
  async incrementView(id: number): Promise<Result<void, CustomError>>
}
```

**IDocsLogWriter 구현의 의미:** `WordServiceContainer`의 `SupabaseDocsLogWriter` 임시 구현체를 `DocsCommandService`로 교체하여 Phase 1 어댑터를 제거한다.

---

## Infrastructure Layer

### SupabaseDocsRepository

- `docs`, `docs_logs`, `user_star_docs` 테이블 담당
- Word 패턴과 동일: `toDocsEntity()` / `toDocsLogEntity()` 변환 헬퍼
- `PostgrestError → failure(infrastructureError(...))` 처리
- `findWordCount()`의 letter/theme/ect 분기 로직을 여기서 처리

### SupabaseWaitDocsRepository

- `docs_wait` 테이블 담당

---

## Service Container

```ts
class DocsServiceContainer {
  readonly docsRepo: IDocsRepository
  readonly waitDocsRepo: IWaitDocsRepository
  readonly queryService: DocsQueryService
  readonly commandService: DocsCommandService
}

function createDocsServiceContainer(supabase: SupabaseClient<Database>): DocsServiceContainer
```

**WordServiceContainer 업데이트:**  
`createWordServiceContainer()`에서 `new SupabaseDocsLogWriter(supabase)` 대신 `docsContainer.commandService`를 주입하도록 변경.

---

## 에러 타입 추가 (domain/errors.ts)

기존 파일에 추가:
- `docsNotFoundError(id: number)` — 404
- `waitDocsNotFoundError(id: number)` — 404

---

## 테스트 계획

| 파일 | 내용 |
|------|------|
| `errors.test.ts` (기존 파일에 추가) | `docsNotFoundError`, `waitDocsNotFoundError` |
| `DocsQueryService.test.ts` | mock repo로 각 query 메서드 단위 테스트 |
| `DocsCommandService.test.ts` | mock repo로 star/requestDocs/approveWaitDocs 워크플로우, IDocsLogWriter 구현 검증 |

Word 도메인 테스트 파일 구조와 동일한 패턴 사용.

---

## 마이그레이션 전략

- 기존 SCM 메서드는 건드리지 않음 (Strangler Fig)
- 소비자 코드 교체는 이번 범위 밖 (별도 PR)
- `WordServiceContainer`의 `SupabaseDocsLogWriter`만 이번에 교체
