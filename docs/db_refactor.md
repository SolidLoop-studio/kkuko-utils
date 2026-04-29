# SupabaseClientManager DDD-Lite 리팩터링 계획

## TL;DR

현재 934줄의 모놀리식 `SupabaseClientManager`를 도메인별 서비스로 분리합니다. 기존 `src/lib/services/`의 DDD 스캐폴딩(domain/result.ts)을 활용하여 **Word+WaitQueue+Theme** 도메인부터 상세 설계하고, Strangler Fig 패턴으로 점진적 이관합니다. 데이터 반환은 기존 `Result<T, E>` 타입으로 통일하고, 인위적 2초 딜레이는 Application Service 레이어에서 관리합니다.

---

## 현재 구조 분석

### 핵심 문제점

| 문제 | 상세 |
|------|------|
| **God Object** | `GetManager` 47개 메서드 ~700줄, 6개 이상 도메인 관심사 혼재 |
| **비즈니스 로직 누출** | 두음법칙, 미션문자 마스크, 노인정 판별 등이 인프라 레이어에 혼재 |
| **중복 코드** | docs-matching 로직이 TableWorkFunc.tsx, WordInfo.tsx 등 7곳에서 반복 |
| **트랜잭션 부재** | AddAccept 같은 10단계 워크플로우가 UI에서 직접 오케스트레이션 — 중간 실패 시 비일관 상태 |
| **CRUD 중심 구조** | `add()` / `get()` / `delete()` / `update()`로 분류 — 도메인 의미 없음 |
| **캐싱 혼재** | `GetManager` 내부에 인메모리 캐시가 인프라 쿼리와 섞여있음 |
| **인터페이스 불일치** | `uploadImage`, `deleteImage`, `getPublicUrl`이 `ISupabaseClientManager` 인터페이스에 없음 |
| **반환 타입 불일치** | `PostgrestSingleResponse`, `{data, error}`, 순수 `number` 등 반환 형태가 메서드마다 다름 |

---

## 도메인 식별 (Bounded Contexts)

분석 결과 7개 도메인 경계가 식별됨:

| 도메인 | 현재 메서드 수 | 복잡도 | 비고 |
|--------|---------------|--------|------|
| **Word** (단어+대기+테마) | ~35 | **높음** | 가장 복잡, 다단계 워크플로우 |
| **Docs** (문서) | ~18 | 중간 | Word의 side-effect로 쓰기, 읽기는 독립적 |
| **User** (사용자/프로필) | ~11 | 낮음 | 대부분 읽기 전용 |
| **Auth** (인증) | 5 | 낮음 | 완전 독립 |
| **Notification** (공지) | 5 | 낮음 | 완전 독립 |
| **Log** (로그) | ~6 | 낮음 | Word/Docs의 side-effect |
| **Stats** (통계) | ~5 | 낮음 | 읽기 전용 |

---

## 타겟 디렉터리 구조

```
src/lib/services/
├── domain/
│   ├── result.ts                      # ✅ 기존 (CustomError, Result<T,E>, success, failure)
│   ├── errors.ts                      # 도메인별 에러 타입 정의
│   │
│   ├── word/
│   │   ├── WordEntity.ts              # Word 엔티티 (value objects 포함)
│   │   ├── WaitWordEntity.ts          # WaitWord 엔티티  
│   │   ├── ThemeEntity.ts             # Theme 엔티티
│   │   ├── WordRepository.ts          # IWordRepository 인터페이스 (Port)
│   │   ├── WaitWordRepository.ts      # IWaitWordRepository 인터페이스 (Port)
│   │   ├── ThemeRepository.ts         # IThemeRepository 인터페이스 (Port)
│   │   └── WordDomainService.ts       # 순수 도메인 로직 (두음법칙 판별, 미션마스크 등)
│   │
│   ├── docs/
│   │   ├── DocsEntity.ts
│   │   ├── DocsRepository.ts          # IDocsRepository 인터페이스
│   │   └── DocsDomainService.ts       # letter/theme docs 매칭 로직
│   │
│   ├── user/
│   │   ├── UserEntity.ts
│   │   └── UserRepository.ts          # IUserRepository 인터페이스
│   │
│   ├── notification/
│   │   ├── NotificationEntity.ts
│   │   └── NotificationRepository.ts  # INotificationRepository 인터페이스
│   │
│   ├── auth/
│   │   └── AuthRepository.ts          # IAuthRepository 인터페이스
│   │
│   └── log/
│       ├── LogEntity.ts
│       └── LogRepository.ts           # ILogRepository 인터페이스
│
├── application/
│   ├── word/
│   │   ├── WordQueryService.ts        # 단어 조회 (검색, 고급검색, 랜덤)
│   │   ├── WordCommandService.ts      # 단어 추가/삭제 워크플로우 오케스트레이션
│   │   └── WordCombinerService.ts     # 단어조합기 전용
│   │
│   ├── docs/
│   │   ├── DocsQueryService.ts        # 문서 조회
│   │   └── DocsCommandService.ts      # 문서 CRUD
│   │
│   ├── user/
│   │   └── UserService.ts             # 유저 조회/기여도
│   │
│   ├── notification/
│   │   └── NotificationService.ts
│   │
│   ├── auth/
│   │   └── AuthService.ts
│   │
│   └── log/
│       └── LogService.ts
│
└── infrastructure/
    ├── supabase/
    │   ├── SupabaseWordRepository.ts      # IWordRepository 구현
    │   ├── SupabaseWaitWordRepository.ts  # IWaitWordRepository 구현
    │   ├── SupabaseThemeRepository.ts     # IThemeRepository 구현
    │   ├── SupabaseDocsRepository.ts      # IDocsRepository 구현
    │   ├── SupabaseUserRepository.ts      # IUserRepository 구현
    │   ├── SupabaseNotificationRepository.ts
    │   ├── SupabaseAuthRepository.ts
    │   ├── SupabaseLogRepository.ts
    │   └── SupabaseStorageRepository.ts   # 이미지 업로드/삭제
    │
    └── cache/
        └── InMemoryCache.ts               # 범용 캐시 유틸 (CACHE_DURATION 로직 추출)
```

---

## Word 도메인 상세 설계

### 1. Domain Layer

#### `domain/word/WordEntity.ts` — 단어 엔티티 + Value Objects

현재 SupabaseClientManager.ts에서 DB Row를 직접 반환하고 있는 것을 도메인 엔티티로 변환:

```ts
// WordEntity
interface WordEntity {
  id: number;
  word: string;
  length: number;
  firstLetter: string;        // word[0]
  lastLetter: string;         // word[word.length-1]
  noinCanuse: boolean;        // 노인정 사용 가능 여부
  kCanuse: boolean;           // 끄코 사용 가능 여부
  missionMark: number;        // 미션 문자 비트마스크
  addedBy: string | null;
  createdAt: string;
}

// WaitWordEntity
interface WaitWordEntity {
  id: number;
  word: string;
  requestType: "add" | "delete";
  requestedBy: string | null;
  requestedAt: string;
  wordId: number | null;      // delete 요청 시 원본 word_id
  themes: ThemeEntity[];      // 연결된 테마들
}

// ThemeEntity
interface ThemeEntity {
  id: number;
  name: string;
}
```

#### `domain/word/WordRepository.ts` (Port — 인터페이스)

현재 `GetManager`의 47개 메서드 중 Word 관련 ~15개를 도메인 의미에 맞게 재정의:

```ts
interface IWordRepository {
  findByWord(word: string): Promise<Result<WordEntity | null, DomainError>>;
  findByWords(words: string[]): Promise<Result<WordEntity[], DomainError>>;
  findByFirstLetters(letters: string[], options: WordFilterOptions): Promise<Result<WordEntity[], DomainError>>;
  findByLastLetters(letters: string[], options: WordFilterOptions): Promise<Result<WordEntity[], DomainError>>;
  findByPrefix(query: string): Promise<Result<string[], DomainError>>;
  findAdvanced(input: AdvancedQueryInput): Promise<Result<WordSearchResult[], DomainError>>;
  findRandom(criteria: { by: 'first' | 'last'; letters: string[] }): Promise<Result<string | null, DomainError>>;
  findAllForCombiner(): Promise<Result<WordListItem[], DomainError>>;
  findAll(filter: WordFilter): Promise<Result<WordListItem[], DomainError>>;
  save(words: NewWord[]): Promise<Result<WordEntity[], DomainError>>;
  upsert(words: NewWord[]): Promise<Result<WordEntity[], DomainError>>;
  deleteByWord(word: string): Promise<Result<WordEntity[], DomainError>>;
  deleteById(id: number): Promise<Result<WordEntity[], DomainError>>;
  deleteByIds(ids: number[]): Promise<Result<WordEntity[], DomainError>>;
}
```

```ts
interface IWaitWordRepository {
  findByWord(word: string): Promise<Result<WaitWordEntity | null, DomainError>>;
  findAll(filter?: "add" | "delete"): Promise<Result<WaitWordEntity[], DomainError>>;
  save(data: NewWaitWord): Promise<Result<WaitWordEntity | null, DomainError>>;
  saveBulk(data: NewWaitWord[]): Promise<Result<WaitWordEntity[], DomainError>>;
  deleteById(id: number): Promise<Result<void, DomainError>>;
  deleteByIds(ids: number[]): Promise<Result<void, DomainError>>;
  deleteByWord(word: string): Promise<Result<void, DomainError>>;
  deleteByWords(words: string[]): Promise<Result<void, DomainError>>;
}
```

```ts
interface IThemeRepository {
  findAll(): Promise<Result<ThemeEntity[], DomainError>>;
  findByName(name: string): Promise<Result<ThemeEntity | null, DomainError>>;
  findThemesByWordId(wordId: number): Promise<Result<ThemeEntity[], DomainError>>;
  findThemesByWordIds(wordIds: number[]): Promise<Result<WordThemeMapping[], DomainError>>;
  saveWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<WordThemeResult[], DomainError>>;
  deleteWordThemes(data: { wordId: number; themeId: number }[]): Promise<Result<void, DomainError>>;
  saveWaitWordThemes(data: { waitWordId: number; themeId: number }[]): Promise<Result<void, DomainError>>;
  saveWordThemeRequests(data: WordThemeRequest[]): Promise<Result<ThemeRequestResult[], DomainError>>;
  findWaitThemesByWordId(wordId: number): Promise<Result<WaitThemeInfo[], DomainError>>;
  findAllWaitThemes(filter?: "add" | "delete"): Promise<Result<WaitThemeInfo[], DomainError>>;
  deleteWaitThemesByIds(ids: number[]): Promise<Result<void, DomainError>>;
}
```

#### `domain/word/WordDomainService.ts` — 순수 도메인 로직

현재 hangulUtils.ts와 lib.ts에 분산된 도메인 로직을 집결:

```ts
class WordDomainService {
  applyDuemLaw(char: string): string;
  reverseDuemLaw(char: string): string[];
  computeMissionMask(chars: string[]): number;
  isNoinWord(themes: string[]): boolean;
  calculateInitials(word: string): string;
  matchDocsForWord(
    word: string,
    themes: string[],
    allDocs: DocsEntity[]
  ): { letterDocs: DocsEntity[]; themeDocs: DocsEntity[] };
}
```

`matchDocsForWord`는 현재 7곳에서 중복되는 docs-matching 로직을 한 곳으로 집중. 이것이 리팩터링의 가장 큰 실질적 가치.

---

### 2. Application Layer

#### `application/word/WordQueryService.ts` — 조회 담당

```ts
class WordQueryService {
  constructor(
    wordRepo: IWordRepository,
    waitWordRepo: IWaitWordRepository,
    themeRepo: IThemeRepository,
    cache: InMemoryCache
  );

  // ✅ 2초 딜레이를 여기서 적용 (rate limiting)
  // wordRepo.findByPrefix + waitWordRepo prefix 합산 + 중복제거 + 정렬
  searchByPrefix(query: string): Promise<Result<string[], DomainError>>;

  // ✅ 2초 딜레이를 여기서 적용
  // letterCountInfo 캐시 활용 → nextWordCount 계산
  searchAdvanced(input: AdvancedQueryInput): Promise<Result<WordSearchResult[], DomainError>>;

  // wordRepo.findByWord + themeRepo.findThemesByWordId + waitWordRepo.findByWord 합산
  getWordInfo(word: string): Promise<Result<WordDetailInfo, DomainError>>;

  getRandomWord(criteria: RandomWordCriteria): Promise<Result<string | null, DomainError>>;

  // InMemoryCache 활용
  getLetterCounts(): Promise<Result<LetterCountInfo, DomainError>>;

  // InMemoryCache 활용, 영어 단어 파일 loaded from storage
  getAllForCombiner(): Promise<Result<WordListItem[], DomainError>>;

  getAllForDownload(filter: WordFilter): Promise<Result<WordListItem[], DomainError>>;
}
```

#### `application/word/WordCommandService.ts` — 워크플로우 오케스트레이션

현재 TableWorkFunc.tsx에 분산된 10단계 워크플로우를 Application Service로 집중:

```ts
class WordCommandService {
  constructor(
    wordRepo: IWordRepository,
    waitWordRepo: IWaitWordRepository,
    themeRepo: IThemeRepository,
    docsRepo: IDocsRepository,
    logRepo: ILogRepository,
    userRepo: IUserRepository,
    domainService: WordDomainService
  );

  // 1. waitWordRepo.findByWord
  // 2. themeRepo.findWaitThemesByWaitWordId
  // 3. wordDomainService.isNoinWord → noinCanuse 판별
  // 4. wordRepo.save
  // 5. themeRepo.saveWordThemes
  // 6. logRepo.saveWordLog
  // 7. wordDomainService.matchDocsForWord → docsRepo.saveLogs + update
  // 8. userRepo.incrementContribution
  // 9. waitWordRepo.deleteById
  acceptAddRequest(waitWordId: number, processedBy: string): Promise<Result<void, DomainError>>;

  rejectAddRequest(waitWordId: number, processedBy: string): Promise<Result<void, DomainError>>;

  acceptDeleteRequest(waitWordId: number, processedBy: string): Promise<Result<void, DomainError>>;

  rejectDeleteRequest(waitWordId: number, processedBy: string): Promise<Result<void, DomainError>>;

  deleteByAdmin(wordId: number, processedBy: string): Promise<Result<void, DomainError>>;

  requestDelete(word: string, requestedBy: string): Promise<Result<void, DomainError>>;

  addWord(word: string, themes: number[], addedBy: string): Promise<Result<void, DomainError>>;

  addWordsBulk(
    words: NewWord[],
    themes: number[],
    addedBy: string
  ): Promise<Result<BulkResult, DomainError>>;
}
```

---

### 3. Infrastructure Layer

#### `infrastructure/supabase/SupabaseWordRepository.ts` — IWordRepository 구현

현재 `GetManager`, `AddManager`, `DeleteManager`에서 `words` 테이블 관련 Supabase 쿼리만 추출:

```ts
class SupabaseWordRepository implements IWordRepository {
  constructor(supabase: SupabaseClient<Database>);

  // 각 메서드는 Supabase 쿼리 실행 후 → 도메인 엔티티로 매핑 → Result<T, E> 반환
  // PostgrestError → DomainError 변환을 여기서 처리
  // storageErrorToPostgresError 같은 어댑터 로직도 여기
}
```

#### `infrastructure/cache/InMemoryCache.ts` — 범용 캐시

현재 `GetManager`의 `wordsCache`, `wordLetterCountsCacheTime` 등을 범용화:

```ts
class InMemoryCache<K extends string | number, V> {
  constructor(duration: number = 10 * 60 * 1000);
  get(key: K): V | null;
  set(key: K, value: V): void;
  invalidate(key: K): void;
  clear(): void;
}
```

---

## 나머지 도메인 설계 (개요)

| 도메인 | Repository Port | Application Service | 주요 변경 |
|--------|----------------|--------------------|---------| 
| **Docs** | `IDocsRepository` (14개 메서드: allDocs, docsInfo, docsWords, docsWordCount, docsLogs 등) | `DocsQueryService` + `DocsCommandService` | `docsWords()` 120줄 로직을 Repository + DomainService로 분리 |
| **User** | `IUserRepository` (userById, userByNickname, allUser, contribution 등 11개) | `UserService` | 대부분 단순 CRUD, contribution 업데이트만 command |
| **Auth** | `IAuthRepository` (session, loginByGoogle, logout, onAuthStateChange, getJWT) | `AuthService` | 기존 `SupabaseClientManager` 루트 메서드 이관 |
| **Notification** | `INotificationRepository` (5개 메서드) | `NotificationService` | 완전 독립, `uploadImage` 포함 |
| **Log** | `ILogRepository` (wordLog, docsLog, logsByFilter, logsByIds 등 6개) | `LogService` | Word/Docs CommandService에서 호출 |
| **Stats** | `IStatsRepository`로 분리하거나 Word와 합칠 수 있음 | WordQueryService 안에 통합 | `letterCountInfo`, `wordState`, `wordsCount` 등 |

---

## 마이그레이션 전략 (Strangler Fig)

### Phase 1: Word 도메인 (최우선)

1. `domain/word/` 엔티티 + Repository 인터페이스 정의
2. `domain/word/WordDomainService.ts` — 기존 hangulUtils.ts + lib.ts 함수들을 import하여 조합
3. `infrastructure/supabase/SupabaseWordRepository.ts` — `GetManager`/`AddManager`/`DeleteManager`에서 word 관련 쿼리 추출
4. `infrastructure/cache/InMemoryCache.ts` — `wordsCache` 로직 추출
5. `application/word/WordQueryService.ts` — 검색/조회 로직 이관 (2초 딜레이 포함)
6. `application/word/WordCommandService.ts` — TableWorkFunc.tsx의 워크플로우 이관
7. supabaseClient.ts에서 Word Service 인스턴스 export
8. 소비자 코드에서 `SCM.get().wordInfoByWord()` → `WordQueryService.getWordInfo()` 점진적 교체

### Phase 2: Docs + Log 도메인

9. `docsWords()` 120줄 쿼리 분리
10. docs-matching 중복 코드 제거 (7곳 → `WordDomainService.matchDocsForWord` 1곳)

### Phase 3: User + Auth + Notification

11. 가장 단순한 도메인들 이관
12. `uploadImage`/`deleteImage` 인터페이스 불일치 해결

### Phase 4: 정리

13. 기존 `SupabaseClientManager` 제거
14. `ISupabaseClientManager` 인터페이스 제거
15. `SCM` 싱글톤을 도메인별 서비스 싱글톤으로 교체

---

## Result 타입 활용 패턴

기존 `src/lib/services/domain/result.ts`의 `Result<T, E>`를 전 레이어에서 사용:

```ts
// domain/errors.ts
// DomainError extends CustomError 하위 타입들:
//   - WordNotFoundError  (httpStatus: 404)
//   - WordAlreadyExistsError (httpStatus: 409)
//   - ThemeNotFoundError (httpStatus: 404)
//   - UnauthorizedError (httpStatus: 401)
//   - ValidationError (httpStatus: 400)
//   - InfrastructureError (httpStatus: 500) — PostgrestError 래핑

// Infrastructure → Result 변환 예시
// SupabaseWordRepository.findByWord():
//   PostgrestError 발생 시 → failure(new InfrastructureError(postgrestError))
//   data가 null일 때 → success(null)
//   정상 → success(toWordEntity(data))

// Application Service → Result 그대로 전달

// Consumer(UI)에서:
//   const result = await wordQueryService.getWordInfo("사과");
//   if (!result.success) { showError(result.error.message); return; }
//   const word = result.data;
```

---

## Verification

| 검증 항목 | 방법 |
|-----------|------|
| 기존 테스트 통과 | `npm test` — 85개 테스트 전부 통과 확인 |
| 타입 안전성 | `npx tsc --noEmit` — 컴파일 에러 없음 확인 |
| Lint 통과 | `npm run lint` — 경고 없음 확인 |
| Phase별 회귀 테스트 | 각 Phase 완료 후 dev 서버 기동, Word 관련 기능 수동 확인 |
| 새 단위 테스트 | 각 Application Service와 DomainService에 대한 테스트 작성 (mock repository 활용) |
| 기존 SCM과 동시 동작 | Strangler Fig — 이관 안 된 메서드는 기존 SCM 계속 사용 |

---

## Decisions

| 결정 | 선택 |
|------|------|
| 마이그레이션 전략 | Strangler Fig 패턴 — 기존 `SCM`과 새 도메인 서비스가 공존하며 점진적 이관 |
| 코드 위치 | 기존 `src/lib/services/` 스캐폴딩 활용 |
| 우선 도메인 | Word+WaitQueue+Theme — 가장 복잡하고 비즈니스 로직이 많은 영역부터 착수 |
| 2초 딜레이 | Application Service 레이어에서 유즈케이스 단위로 관리 |
| 기존 유틸 | hangulUtils.ts / lib.ts 유지, `WordDomainService`에서 import하여 조합 (복사 아님) |
| 캐시 | `ReactQuery`의 `queryClient.ensureQueryData`로 관리, Application Service에서 관리 |
