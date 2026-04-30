# SupabaseClientManager DDD-Lite 사용 가이드

이 문서는 `SupabaseClientManager`가 `DDD-lite` 패턴으로 리팩터링된 이후, **새 서비스 사용 방법**과 **기능 추가/수정 절차**를 정리한 가이드입니다. 신규 팀원이 빠르게 이해하고 실수 없이 작업할 수 있도록 최소한의 규칙과 예제를 포함합니다.

---

## 1) 구조 개요

DDD-lite 구조는 아래 3층으로 나뉩니다.

- **Domain**: 비즈니스 규칙과 타입 (엔티티, 에러, Result)
- **Application**: 유즈케이스 오케스트레이션 (읽기/쓰기 서비스)
- **Infrastructure**: Supabase 쿼리 구현 (Repository)

폴더 구조는 다음과 같습니다.

```
src/lib/services/
├── domain/           # 엔티티/에러/Result
├── application/      # Query/Command 서비스
├── infrastructure/   # Supabase Repository 구현
└── *ServiceContainer.ts
```

핵심 진입점은 `ServiceContainer`입니다. 예: Word 도메인은 [src/lib/services/WordServiceContainer.ts](../src/lib/services/WordServiceContainer.ts)

---

## 2) 기본 사용법 (읽기/검색)

### 2-1. 브라우저(클라이언트)에서 사용

기본 컨테이너는 [src/app/lib/supabaseClient.ts](../src/app/lib/supabaseClient.ts)에 준비되어 있습니다.

```ts
import { wordContainer } from '@/src/app/lib/supabaseClient';
import { ErrModal } from '@/src/app/components/ErrModal';

async function loadWords() {
  const result = await wordContainer.queryService.searchByPrefix('가');

  if (!result.success) {
    // UI 에러 처리: ErrModal 사용
    ErrModal({ title: '조회 실패', body: result.error.message });
    return [];
  }

  return result.data; // string[]
}
```

### 2-2. 서버(서버 컴포넌트/라우트)에서 사용

서버에서는 `createSupabaseServerClient()`로 Supabase를 만든 후 컨테이너를 생성합니다.

```ts
import { createSupabaseServerClient } from '@/src/app/lib/supabaseServer';
import { createWordServiceContainer } from '@/src/lib/services/WordServiceContainer';

export async function getWordsOnServer() {
  const supabase = await createSupabaseServerClient();
  const wordContainer = createWordServiceContainer(supabase);

  return wordContainer.queryService.searchByPrefix('가');
}
```

---

## 3) 기본 사용법 (쓰기/승인 워크플로우)

쓰기/승인 로직은 `CommandService`에만 구현합니다. 예: [src/lib/services/application/word/WordCommandService.ts](../src/lib/services/application/word/WordCommandService.ts)

```ts
import { wordContainer } from '@/src/app/lib/supabaseClient';
import { FailModal } from '@/src/app/components/FailModal';

async function approveAdd(word: string, adminId: string | null) {
  const result = await wordContainer.commandService.acceptAddRequest(word, adminId);

  if (!result.success) {
    // 실패 UI 처리: 4xx 성격이면 FailModal 사용
    FailModal({ title: '승인 실패', body: result.error.message });
    return;
  }

  // 성공 처리
}
```

---

## 4) Result 패턴 규칙

모든 서비스는 `Result<T, CustomError>`를 반환합니다.

- `success: true`이면 `data` 사용
- `success: false`이면 `error` 사용

이 규칙 덕분에 **try/catch 없이도** 정상/오류 흐름을 명확하게 분리할 수 있습니다.

---

## 5) 기능 추가/수정 절차

기능 변경은 아래 순서를 지키는 것이 안전합니다.

### A. 읽기 기능 추가 (Query)

1. **Domain 타입 정의** (필요 시)
   - [src/lib/services/domain/word/WordEntity.ts](../src/lib/services/domain/word/WordEntity.ts)
2. **Repository 인터페이스 추가**
   - [src/lib/services/domain/word/WordRepository.ts](../src/lib/services/domain/word/WordRepository.ts)
3. **Supabase Repository 구현**
   - [src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts](../src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts)
4. **QueryService에 노출**
   - [src/lib/services/application/word/WordQueryService.ts](../src/lib/services/application/word/WordQueryService.ts)
5. **UI/Hook에서 사용**
   - 컨테이너를 통해 `queryService` 호출

### B. 쓰기 기능 추가 (Command)

1. **도메인 규칙(검증/판별) 정리**
   - [src/lib/services/domain/word/WordDomainService.ts](../src/lib/services/domain/word/WordDomainService.ts)
2. **Repository 인터페이스/구현 추가**
3. **CommandService에 워크플로우 추가**
   - [src/lib/services/application/word/WordCommandService.ts](../src/lib/services/application/word/WordCommandService.ts)
4. **필요하면 다른 도메인 서비스 의존성 추가**
   - Docs/Log/User 서비스 컨테이너에서 주입

---

## 6) 간단 예제: "단어 길이로 검색" 추가

### 6-1. Repository 인터페이스에 선언

```ts
// WordRepository.ts
findByLengthRange(min: number, max: number): Promise<Result<WordListItem[], CustomError>>;
```

### 6-2. Supabase Repository 구현

```ts
// SupabaseWordRepository.ts
async findByLengthRange(min: number, max: number) {
  const { data, error } = await this.supabase
    .from('words')
    .select('word, noin_canuse, k_canuse')
    .gte('length', min)
    .lte('length', max);

  if (error) return failure(infrastructureError(error));

  return success((data ?? []).map((row) => ({
    word: row.word,
    noinCanuse: row.noin_canuse,
    kCanuse: row.k_canuse,
    status: 'ok',
  })));
}
```

### 6-3. QueryService에 노출

```ts
// WordQueryService.ts
async getWordsByLength(min: number, max: number) {
  return this.wordRepo.findByLengthRange(min, max);
}
```

### 6-4. UI에서 사용

```ts
const result = await wordContainer.queryService.getWordsByLength(2, 4);
if (!result.success) {
  ErrModal({ title: '조회 실패', body: result.error.message });
  return;
}
```

---

## 7) 자주 하는 실수 체크리스트

- `SupabaseClientManager`에 직접 기능 추가하지 말 것 (점진적 이관 구조 유지)
- 읽기 로직에 비즈니스 규칙을 넣지 말 것 → DomainService로 이동
- Supabase 쿼리는 **Infrastructure**에만 존재해야 함
- `Result`를 무시하고 `try/catch`로만 처리하지 말 것

---

## 8) 관련 파일 링크

- Word 컨테이너: [src/lib/services/WordServiceContainer.ts](../src/lib/services/WordServiceContainer.ts)
- Word Query 서비스: [src/lib/services/application/word/WordQueryService.ts](../src/lib/services/application/word/WordQueryService.ts)
- Word Command 서비스: [src/lib/services/application/word/WordCommandService.ts](../src/lib/services/application/word/WordCommandService.ts)
- Supabase Word Repository: [src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts](../src/lib/services/infrastructure/supabase/SupabaseWordRepository.ts)
- 기본 컨테이너 바인딩: [src/app/lib/supabaseClient.ts](../src/app/lib/supabaseClient.ts)
