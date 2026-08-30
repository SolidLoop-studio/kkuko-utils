# 단어 상세 조회 DDD-lite 이전 설계

## 목적

Phase 3 `word-catalog`의 두 번째 세로 슬라이스로 단어 상세 화면의 읽기 경계를 분리한다. 현재 `WordInfoPage.tsx`가 `SCM.get()` 메서드를 순서대로 호출하고 Supabase 응답을 화면 props로 조립하는 책임을 `word-catalog`의 Application 계약과 browser Infrastructure adapter로 이동한다.

이 작업은 공개 화면의 정보와 mutation 동작을 바꾸지 않는다. 완료 후 `WordInfoPage.tsx`는 `SCM`, Supabase 응답 타입, 테이블·컬럼·RPC 이름을 알지 않으며, 단어 상세 조회와 임의 연결 단어 조회는 feature hook만 사용한다.

## 범위

이번 슬라이스에 포함한다.

- 승인 단어 또는 추가 대기 단어의 상세 조회
- 삭제 대기 요청 상태와 요청자 정보 반영
- 승인·추가 대기·삭제 대기 주제 조회와 화면용 분류
- 글자 및 주제 기반 관련 docs 조회
- 앞 글자로 끝나는 단어 수와 끝 글자로 시작하는 단어 수 조회
- 두음법칙이 반영된 후보 목록을 이용한 임의 연결 단어 조회
- React Query 기반 로딩, 오류, 재조회 및 임의 조회 pending 상태
- 대체된 legacy `SCM` 메서드와 인터페이스 제거

이번 슬라이스에서 제외한다.

- 단어 상세 mutation의 정책 또는 RPC 변경
- 끄코위키 API와 Route Handler의 구조 변경
- docs context 자체의 조회 계약 이전
- `WordAddHome.tsx`에 남은 등록 단어 존재 여부 조회 이전
- 고급 검색 Route Handler, 다운로드, 통계 화면의 이전
- DB schema 또는 migration 변경

## 검토한 접근법

### 기존 호출을 facade로 감싸기

`WordInfoPage.tsx`의 호출 순서를 별도 함수로 옮기고 내부에서 `SCM`을 계속 사용한다. 변경량은 작지만 새 경계가 legacy manager에 의존하므로 점진 제거라는 목표를 달성하지 못한다.

### 조회마다 작은 hook 만들기

단어, 요청, 주제, docs, 글자 수를 각각 React Query hook으로 만든다. 개별 cache는 세밀해지지만 화면이 다시 조회 순서와 부분 실패를 조립하게 되고, 현재 컴포넌트 결합을 다른 형태로 유지한다.

### 화면 projection과 임의 조회를 Application 계약으로 분리하기

단어 상세 화면이 한 번에 필요로 하는 데이터를 `WordDetail` projection으로 반환하고, 클릭할 때마다 새 결과가 필요한 임의 연결 단어 조회만 별도 계약으로 둔다. 화면 조립 책임과 `SCM` 의존을 함께 제거하며 기존 검색 슬라이스의 Query Service, gateway, mapper, React Query 패턴을 재사용할 수 있다. 이 접근법을 채택한다.

## Application 계약

`word-catalog/application`에 상세 조회 전용 타입과 port를 둔다. 생성된 Supabase Row 타입은 이 계층에 노출하지 않는다.

```ts
export type WordDetailStatus =
    | 'registered'
    | 'pending-addition'
    | 'pending-deletion';

export interface WordDetailDocument {
    id: number;
    name: string;
}

export interface WordDetail {
    id: number;
    word: string;
    status: WordDetailStatus;
    canUseInChain: boolean;
    canUseWithoutInjeong: boolean;
    requesterId?: string;
    requesterNickname?: string;
    requestedAt?: string;
    themes: {
        approved: string[];
        pendingAddition: string[];
        pendingDeletion: string[];
    };
    documents: WordDetailDocument[];
    previousWordCount: number;
    nextWordCount: number;
}

export type WordConnectionDirection = 'previous' | 'next';

export interface WordDetailQueryGateway {
    findDetail(word: string): Promise<Result<WordDetail | null>>;
    findRandomConnectedWord(input: {
        direction: WordConnectionDirection;
        letters: string[];
    }): Promise<Result<string | null>>;
}
```

`GetWordDetailService`는 빈 검색어를 validation error로 거부하고 gateway 결과가 `null`이면 `not-found` ApplicationError로 변환한다. 임의 연결 단어 조회는 빈 후보 배열을 validation error로 거부하며, 결과가 없으면 성공한 `null`을 반환한다. 테이블별 범용 repository는 만들지 않는다.

## Infrastructure와 mapper

browser Supabase adapter는 기존 browser client를 주입받아 다음 조회를 수행한다.

1. `words`와 `wait_words`에서 같은 단어를 조회한다.
2. 승인 단어가 있으면 `word_themes`와 `word_themes_wait`를 조회한다.
3. 승인 단어가 없고 대기 단어가 있으면 `wait_word_themes`를 조회한다.
4. 단어 끝 글자의 letter docs와 관련 주제의 theme docs를 조회한다.
5. 시작·끝 글자 count view와 대기 단어 count를 합산한다.
6. raw row를 `WordDetail`로 변환한다.

현재 동작을 다음과 같이 보존한다.

- 승인 단어와 삭제 요청이 함께 있으면 `pending-deletion`이며 요청자와 요청 시각은 삭제 요청에서 가져온다.
- 승인 주제 중 대기 변경에 포함된 주제는 승인 목록에서 제외한다.
- 승인 단어가 없고 대기 단어만 있으면 `pending-addition` projection을 만든다.
- letter docs 다음 theme docs 순서와 현재의 중복 허용 동작을 유지한다.
- 연결 단어 수 하위 조회 실패는 현재와 같이 해당 값을 `0`으로 완화한다.
- 핵심 단어·요청·주제·docs 조회의 오류나 예상하지 못한 row shape는 안정적인 infrastructure error로 변환한다.

임의 연결 단어 adapter는 현재와 같은 순서로 승인 단어 RPC를 먼저 확인하고, 결과가 없으면 대기 단어 RPC를 확인한다. RPC 오류는 infrastructure error, 두 결과가 모두 비어 있으면 성공한 `null`이다.

## Presentation과 데이터 흐름

`useWordDetail(query)`는 `wordCatalogQueryKeys.detail(query)`로 상세 projection을 조회한다. 기존 `unwrapWordCatalogQuery`와 retry 정책을 재사용하며, mutation 완료 후 `reloadWordInfo`는 해당 detail query를 invalidate 또는 refetch한다.

임의 연결 단어는 매 클릭마다 다른 결과가 필요하므로 cache query가 아니라 React Query mutation 형태의 `useRandomConnectedWord()`로 실행한다. 이름과 Application 계약은 조회임을 유지하되 presentation에서는 명시적 사용자 동작과 pending 상태를 다루기 위해 mutation primitive를 사용한다.

```text
WordInfoPage
  -> useWordDetail(query)
  -> GetWordDetailService
  -> WordDetailQueryGateway
  -> Supabase tables/views
  -> WordDetail DTO
  -> WordInfo props

연결 단어 버튼
  -> useRandomConnectedWord()
  -> GetWordDetailService.findRandomConnectedWord
  -> Supabase RPC adapter
  -> router.push
```

`WordInfoPage.tsx`는 DTO를 기존 `WordInfoProps`의 표시 형태로 변환한다. 미션 글자와 초성처럼 DB와 무관한 계산은 Application projection helper 또는 page mapping에서 순수 함수로 처리한다. 연결 단어 수는 상세 DTO의 숫자를 사용하고, `WordInfo`에 DB 조회 callback을 전달하지 않는다.

끄코위키 존재 여부 확인은 승인 범위에 따라 기존 `/api/get_kkukowiki` 호출을 유지한다. 실패는 계속 best-effort로 무시한다. 다만 이 호출과 `SCM` 오류를 한 오류 모델로 섞지 않는다.

## 오류와 화면 상태

- validation error는 안정적인 사용자 메시지를 표시한다.
- `not-found`는 현재와 같이 Next.js not-found 화면으로 보낸다.
- infrastructure error는 Supabase 원문을 노출하지 않고 `ErrorPage`에 안정적인 메시지를 전달한다.
- 상세 query가 pending인 동안 현재 `LoadingPage`를 유지한다.
- 임의 연결 단어 조회가 pending인 동안 연결 버튼의 로딩 상태를 사용한다.
- 임의 결과가 없으면 현재 단어 경로로 이동하는 기존 동작을 유지한다.
- mutation 성공 후 상세 query만 다시 가져오며 다른 `word-catalog` query를 불필요하게 무효화하지 않는다.

## 파일 구조

예상되는 주요 추가·수정 파일은 다음과 같다. 구현 중 기존 명명 패턴에 맞춰 타입 파일을 합칠 수 있지만 계층 책임은 유지한다.

```text
src/modules/word-catalog/
  application/
    get-word-detail.ts
    word-detail-ports.ts
    word-detail-types.ts
  infrastructure/browser/
    browser-word-catalog-services.ts
    supabase-word-detail-query-gateway.ts
  presentation/
    use-word-detail.ts
    use-random-connected-word.ts
    word-catalog-query-keys.ts
  index.ts

src/app/word/search/[query]/
  WordInfoPage.tsx
  WordInfo.tsx
```

legacy manager에서는 이 화면만 소비하던 상세 주제·docs·count·random 메서드를 제거한다. `wordInfoByWord`는 `WordAddHome.tsx`가 아직 사용하므로 이번 작업에서는 유지한다. 같은 이름의 mutation용 `waitWordThemes` 메서드도 제거 대상이 아니다.

## 테스트 전략

TDD 순서는 Application, Infrastructure, presentation, page 연결 순서로 진행한다.

Application 테스트:

- 빈 단어 validation
- detail not-found 변환
- gateway 성공과 오류 전달
- 임의 연결 단어 후보 validation과 `null` 보존

Infrastructure 테스트:

- 승인 단어 projection
- 삭제 대기 요청이 있는 승인 단어 projection
- 추가 대기 단어 projection
- 승인·대기 주제 분류
- 관련 docs 조합 순서와 중복 보존
- 연결 단어 수 합산 및 오류 시 `0` 완화
- malformed row와 Supabase 오류 매핑
- 승인 RPC 우선, 대기 RPC fallback, 결과 없음

Presentation 테스트:

- detail query key와 service 호출
- Result unwrap, retry, not-found 전달
- 임의 조회 pending과 매 호출 재실행
- 상세 query만 refetch 또는 invalidate

Page characterization/연결 테스트:

- 등록·추가 대기·삭제 대기 DTO가 기존 `WordInfoProps` 의미로 표시됨
- not-found, loading, infrastructure error 화면
- 연결 버튼이 올바른 direction과 후보 글자를 전달하고 기존 fallback 경로로 이동함
- mutation 완료 후 상세 projection 재조회
- `WordInfoPage.tsx`에 `SCM`, Supabase 타입과 직접 query builder가 남지 않음

마지막으로 관련 Jest, 전체 ESLint, `npx tsc --noEmit`을 실행한다. 이 변경에는 DB schema 수정이 없으므로 DB integration test와 production migration은 필요하지 않다.

## 수용 기준

- `WordInfoPage.tsx`의 `SCM`과 `PostgrestError` import가 제거된다.
- 단어 상세 화면의 초기 DB 조합과 임의 연결 단어 조회가 `word-catalog` 계약을 통한다.
- 컴포넌트가 table, column, view, RPC 이름을 알지 않는다.
- Supabase raw row와 오류는 Infrastructure 밖으로 노출되지 않는다.
- 기존 등록·대기·삭제 상태, 주제, docs, count, navigation, 끄코위키 표시 동작이 유지된다.
- 이 화면만 사용하던 legacy getter가 manager와 interface에서 제거된다.
- `wordInfoByWord`처럼 다른 legacy 소비자가 남은 메서드는 섣불리 제거하지 않는다.
- 관련 테스트, ESLint, TypeScript type check가 통과한다.
