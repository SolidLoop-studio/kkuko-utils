# Docs 조회 경계 DDD-lite 이전 설계

## 목적

Phase 4 `docs` context의 남은 조회 경계를 다섯 개의 독립적인 세로 슬라이스로 이전한다. 현재 `words-docs` 화면들이 `SCM.get()` 호출 순서, Supabase 응답 타입, 테이블별 row 조립을 직접 소유하는 책임을 `src/modules/docs`의 Application 계약과 browser Infrastructure adapter로 이동한다.

이번 작업 묶음은 공개 화면의 표시 결과와 기존 mutation 정책을 바꾸지 않는다. 각 슬라이스는 별도 워크트리와 feature branch에서 TDD로 구현하고 리뷰를 통과한 뒤 `refactor/db`에 병합한다. 다음 슬라이스는 직전 병합 결과에서 분기한다.

## 범위와 순서

다음 다섯 작업을 순서대로 수행한다.

1. `WordsDocsHome.tsx`의 대기 중인 docs 요청 중복 확인 조회
2. `WordsDocsHomePage.tsx`의 docs 목록 조회
3. `words-docs/[id]/logs/DocsLogPage.tsx`의 docs 로그 projection 조회
4. `words-docs/[id]/info/DocsInfoPage.tsx`의 docs 정보 projection 조회
5. `words-docs/[id]/DocsDataPage.tsx`와 `DocsDataHome.tsx`의 docs 본문·즐겨찾기 사용자·최근 갱신 조회

각 작업은 그 화면이 필요로 하는 query DTO, 작은 gateway port, Application service, Supabase adapter, React Query hook을 추가한다. 앞 작업에서 만든 공통 query key와 Result unwrap/retry 정책은 뒤 작업이 재사용한다.

이번 범위에서 제외한다.

- `waitDocs`, `docView`, `starDocs`, `startDocs` 등 docs mutation의 새 구조 이전
- Phase 0B의 docs 의미 키, reference seed, trigger 변경
- `admin/logs`, `word/add`, profile 등 다른 context가 사용하는 `allDocs` 조회
- 기존 화면의 레이아웃, 정렬, 필터, 페이지네이션 또는 사용자 문구 변경
- Supabase schema, RPC 또는 migration 변경

기존 docs mutation은 Phase 0B 완료 전까지 legacy 경계에 남긴다. 조회와 mutation이 같은 컴포넌트에 공존하는 경우 조회만 feature hook으로 이동하고, 남은 mutation 때문에 필요한 `SCM` import는 유지한다. 이는 해당 조회를 legacy manager에 남기는 근거가 아니며, 나중 mutation 슬라이스에서 import를 최종 제거한다.

## 검토한 접근법

### 화면 호출을 별도 facade로 옮기기

현재 `SCM` 호출을 화면별 함수로 옮기면 UI 파일은 짧아지지만 새 함수가 넓은 manager와 Supabase response shape에 계속 결합된다. strangler 방식으로 legacy 경계를 축소하지 못하므로 채택하지 않는다.

### 테이블별 범용 docs repository 만들기

`docs`, `docs_logs`, `docs_star` CRUD를 하나의 repository에 모으면 기존 SCM의 축소판이 된다. 화면별 projection 규칙과 오류 정책이 다시 호출자에게 노출되므로 채택하지 않는다.

### 화면 projection 단위의 query service 구성

각 사용자 화면이 한 번에 필요로 하는 결과를 Application DTO로 정의하고 Infrastructure adapter가 Supabase row를 조합한다. 화면은 feature hook과 안정적인 오류만 알며, query key와 cache 소유권도 명확해진다. 기존 `word-catalog`와 첫 docs request query의 패턴을 재사용할 수 있어 이 접근법을 채택한다.

## 공통 계층과 계약

`src/modules/docs`는 기존 moderation 계약과 함께 read-only 계약을 확장한다.

```text
Presentation component
  -> React Query hook
  -> Application query service
  -> small query gateway port
  -> browser Supabase adapter
  -> Application DTO
```

공통 규칙은 다음과 같다.

- Domain과 Application은 React, Next.js, Supabase, 생성된 DB 타입을 import하지 않는다.
- gateway는 화면별 projection을 반환하며 테이블별 범용 CRUD API를 노출하지 않는다.
- adapter 입력은 `unknown`으로 취급하고 row 전체를 좁힌 뒤 DTO로 변환한다.
- Application은 `Result<T>`와 안정적인 `ApplicationError`만 반환한다.
- raw PostgREST 오류의 message, details, code는 사용자 화면에 노출하지 않는다.
- React Query key는 `docsQueryKeys` 아래에서 docs id와 projection 종류를 구분한다.
- validation 오류는 재시도하지 않고 infrastructure 오류는 기존 docs query 제한만큼 재시도한다.
- 조회 결과가 없는 정상 상태는 projection별로 `null` 또는 빈 배열로 명시하고 infrastructure 실패와 구분한다.

## 작업 1: 대기 docs 요청 중복 확인

`WordsDocsHome.tsx`는 새 글자 docs 요청 제출 직전에 기존 글자 docs와 대기 요청을 확인한다. 이번 작업은 `SCM.get().addWaitDocs()`만 기존 `usePendingDocsRequests` query 경계로 바꾼다.

제출 시점의 검증이 mount 시점 cache에만 의존하지 않도록 hook의 `refetch` 결과를 사용한다. 조회 실패에는 기존 안정적인 한국어 오류를 표시하고, raw Supabase 오류를 이어 붙이지 않는다. 동일한 `docsName`이 있으면 기존의 “이미 추가 요청된 문서명입니다.” 동작을 유지한다.

`letterDocs()` 조회와 `waitDocs()` mutation은 이 슬라이스에서 유지한다. 따라서 `WordsDocsHome.tsx`의 `SCM` import 자체는 아직 제거하지 않지만, `addWaitDocs()`의 마지막 production 소비자가 사라지면 legacy manager와 interface에서 해당 getter를 삭제한다.

## 작업 2: docs 목록 조회

목록 화면은 다음 projection만 소비한다.

```ts
export interface DocsSummary {
    id: number;
    name: string;
    makerNickname: string | null;
    lastUpdatedAt: string;
    createdAt: string;
    type: 'letter' | 'theme' | 'ect';
}
```

`GetDocsListService.get()`과 `DocsListQueryGateway.loadAll()`을 추가한다. browser adapter는 현재 목록과 동일한 docs 및 maker nickname을 조회하고 camelCase DTO로 변환한다. `useDocsList()`는 `docsQueryKeys.list`를 사용한다.

`WordsDocsHomePage.tsx`는 hook의 loading/error/data 상태만 처리하고 기존 `WordsDocsHome` props로 얇게 매핑한다. `SCM`, `useEffect`, PostgREST 오류 조립과 수동 loading progress를 제거한다. 다른 legacy 소비자가 `allDocs()`를 사용하므로 manager 메서드는 유지한다.

## 작업 3: docs 로그 projection 조회

로그 화면은 docs 존재 여부와 해당 docs 로그를 하나의 projection으로 조회한다.

```ts
export interface DocsLogEntry {
    id: number;
    word: string;
    userNickname: string | null;
    occurredAt: string;
    type: 'add' | 'delete';
}

export interface DocsLogProjection {
    docsId: number;
    docsName: string;
    entries: DocsLogEntry[];
}
```

`GetDocsLogsService.get(docsId)`는 안전한 양의 정수 id를 검증하고 gateway의 `null`을 not-found 오류로 변환한다. adapter는 docs metadata를 먼저 확인하고 존재하는 경우 로그를 조회한다. 로그 정렬은 현재 Supabase manager의 순서를 그대로 보존한다.

`useDocsLogs(id)`는 `docsQueryKeys.logs(id)`를 사용한다. `DocsLogPage.tsx`는 DTO를 현재 `DocsLogs` props로 매핑하며 SCM과 Supabase 오류 타입을 제거한다. 이 작업 뒤 production 소비자가 없는 `docsLogs()`는 manager와 interface에서 제거한다. `docsInfoByDocsId()`는 뒤 작업들이 이전될 때까지 유지한다.

## 작업 4: docs 정보 projection 조회

정보 화면은 metadata, 단어 수, 즐겨찾기 수, 조회수 순위를 한 번에 받는다.

```ts
export interface DocsInfoProjection {
    metadata: {
        id: number;
        createdAt: string;
        name: string;
        makerNickname: string | null;
        type: 'letter' | 'theme' | 'ect';
        lastUpdatedAt: string;
        views: number;
    };
    wordCount: number;
    starCount: number;
    viewRank: number;
}
```

Infrastructure가 docs 종류에 따른 count query와 theme lookup을 소유한다. `letter`와 `theme` 규칙은 현재 동작을 유지하고, `ect`는 현재 지원되는 특수 docs만 projection을 반환한다. 지원하지 않는 docs 유형·id는 not-found로 취급한다. 숫자 id의 의미를 새 Domain 규칙으로 승격하지 않고 기존 동작의 호환 분기로 adapter 내부에 격리한다. Phase 0B에서 이 분기를 의미 키로 교체한다.

`DocsInfoPage.tsx`는 `useDocsInfo(id)`만 사용하고 현재 `DocsInfo` 표시 계약으로 매핑한다. 이 작업 뒤 production 소비자가 없는 `docsStarCount()`, `docsWordCount()`, `docsVeiwRankByDocsId()`는 제거한다. `themeInfoByThemeName()`과 `docsInfoByDocsId()`는 작업 5가 끝날 때까지 유지한다.

## 작업 5: docs 본문 projection 조회

본문 화면의 초기 조회와 관리자 action 후 snapshot 새로고침이 같은 Application 경계를 사용한다.

```ts
export interface DocsContentWord {
    word: string;
    status: 'ok' | 'add' | 'delete';
    requesterNickname?: string;
}

export interface DocsContentProjection {
    metadata: {
        id: number;
        title: string;
        lastUpdatedAt: string;
        type: 'letter' | 'theme' | 'ect';
    };
    starredUserIds: string[];
    words: DocsContentWord[];
    isSpecial: boolean;
}
```

`GetDocsContentService.get(docsId)`는 docs metadata, 즐겨찾기 사용자 id, 종류별 승인·대기 단어를 조합한다. 삭제 요청이 있는 승인 단어 제외, 글자 docs에서 한 글자 대기 row 제외, 요청 상태와 요청자 매핑, 기존 특수 docs 범위 판정은 현재 동작을 보존한다. mutation target 보강은 이미 존재하는 `GetDocsWordMutationTargetsService`를 명시적인 port로 주입해 Application composition에서 수행하거나, 기존 `enrichDocsWordData`를 UI mapping 단계에서 계속 사용한다. 어느 방식을 택하더라도 `modules/docs`가 `modules/word-moderation`의 Infrastructure 구현을 직접 import하지 않는다.

`useDocsContent(id)`는 초기 조회와 화면 새로고침에 같은 `docsQueryKeys.content(id)`를 사용한다. `DocsDataPage.tsx`는 본문 DTO와 mutation target 결과를 기존 `DocsDataHome` props로 전달한다. `DocsDataHome.tsx`의 관리자 action 완료 후 직접 `docsLastUpdate()`와 `docsWords()`를 호출하는 snapshot refresh는 content query refetch로 대체한다.

본문 조회 성공과 `docView()` 증가는 독립적으로 처리한다. 기존 best-effort 조회수 증가는 legacy mutation 경계에 남기며 실패가 본문 표시를 막지 않는다. `DocsDataPage.tsx`에는 이 mutation을 위한 좁은 legacy 호출이 남을 수 있다. 즐겨찾기 추가·삭제 mutation도 `DocsDataHome.tsx`에 유지한다.

이 작업 뒤 production 소비자가 없어진 `docsWords()`, read `docsLastUpdate()`, `docsStar()`, `docsInfoByDocsId()`, `themeInfoByThemeName()`을 manager와 interface에서 제거한다. update manager의 동명 `docsLastUpdate(docsIds)` mutation은 제거하지 않는다.

## 오류와 화면 상태

- 목록과 로그 빈 배열은 정상 성공으로 표시한다.
- 존재하지 않는 docs id 또는 지원하지 않는 기존 특수 docs는 현재와 같이 NotFound 화면을 표시한다.
- malformed row, Supabase 오류, 예기치 않은 throw는 projection별 안정적인 infrastructure 오류로 변환한다.
- 기존 `LoadingPage`, `ErrorPage`, `NotFound`의 화면 전환 의미를 유지한다.
- refetch 중 기존 성공 데이터를 무조건 지우지 않으며 관리자 action 완료 뒤 최신 snapshot으로 교체한다.
- raw DB 오류 문자열과 column/RPC 이름은 presentation으로 전달하지 않는다.

## 캐시와 무효화

예상 query key는 다음과 같다.

```ts
export const docsQueryKeys = {
    all: ['docs'] as const,
    list: ['docs', 'list'] as const,
    pendingRequests: ['docs', 'requests', 'pending'] as const,
    logs: (id: number) => ['docs', id, 'logs'] as const,
    info: (id: number) => ['docs', id, 'info'] as const,
    content: (id: number) => ['docs', id, 'content'] as const,
};
```

mutation 후에는 영향받는 구체 key만 refetch 또는 invalidate한다. 이번 작업에서 legacy mutation hook을 새로 만들지 않으므로 기존 mutation 완료 callback에서 content refetch를 호출한다. 서로 다른 projection의 캐시를 무차별적으로 초기화하지 않는다.

## 파일 구조

구현은 기존 `modules/docs` 패턴을 따른다. 책임이 다른 projection을 한 거대한 파일에 합치지 않는다.

```text
src/modules/docs/
  application/
    docs-list-*.ts
    docs-log-*.ts
    docs-info-*.ts
    docs-content-*.ts
  infrastructure/browser/
    browser-docs-services.ts
    supabase-docs-list-query-gateway.ts
    supabase-docs-log-query-gateway.ts
    supabase-docs-info-query-gateway.ts
    supabase-docs-content-query-gateway.ts
  presentation/
    docs-query-keys.ts
    docs-query-result.ts
    use-docs-list.ts
    use-docs-logs.ts
    use-docs-info.ts
    use-docs-content.ts
  index.ts
```

정확한 파일명은 구현 계획에서 기존 naming convention과 공개 export를 대조해 확정한다. 각 파일은 하나의 projection 계약 또는 adapter 책임을 가진다.

## 테스트 전략

각 작업은 별도 TDD red-green-refactor cycle을 따른다.

Application 테스트:

- docs id validation
- gateway 성공·오류 전달
- `null`의 not-found 변환
- projection별 빈 배열 보존

Infrastructure 테스트:

- 필요한 table/select/filter/order 호출
- nullable join과 camelCase DTO 매핑
- docs 종류별 단어 및 count 조합
- pending 삭제 제외와 요청 상태 mapping
- malformed row, query error, thrown query의 안정적 오류 변환
- 특수 docs 호환 범위와 unsupported id 처리

Presentation hook 테스트:

- projection별 query key
- service 호출과 Result unwrap
- validation/infrastructure retry 정책
- id 변경 시 별도 cache entry
- refetch가 최신 projection을 반환함

화면 연결 테스트:

- 기존 loading, error, not-found, empty 화면
- DTO가 현재 child component props와 동일한 의미로 표시됨
- 작업 1 중복 요청 검증이 submit 시점 refetch 결과를 사용함
- 작업 5 관리자 action 완료 뒤 content query가 다시 로드됨
- 이전된 조회 파일에 Supabase 응답 타입과 직접 query builder가 남지 않음
- 제거하기로 한 SCM getter의 production 소비자가 0개임

각 branch에서 관련 Jest, `npm run lint`, `npx tsc --noEmit`, `git diff --check`를 실행한다. 병합된 `refactor/db`에서도 작업별 관련 테스트를 재실행한다. 다섯 작업 병합 후 전체 `npm test -- --runInBand`를 실행한다. DB schema를 바꾸지 않으므로 Supabase integration test는 필요하지 않다.

## 워크트리와 리뷰 절차

각 작업은 직전 작업이 병합된 `refactor/db`에서 새 branch와 `.worktrees/<branch>`를 만든다. lockfile이 바뀌지 않으므로 기존 `node_modules`를 directory junction 또는 symlink로 연결할 수 있으며, 정리할 때 링크만 제거한다.

구현 서브에이전트는 해당 작업 brief만 읽고 TDD 증거, 변경 파일, 검증 결과, commit을 report 파일에 기록한다. 컨트롤러는 diff package를 별도 리뷰 서브에이전트에게 전달한다. Critical/Important finding은 원 구현자에게 돌려보내 수정과 scoped re-review를 수행한다.

리뷰와 검증이 통과하면 feature branch를 `refactor/db`에 로컬 병합하고 병합 결과를 다시 검증한다. 그 다음 소유한 worktree와 feature branch를 정리하고 다음 작업을 시작한다. 서로 다른 작업의 구현 서브에이전트를 병렬 실행하지 않는다.

## 수용 기준

- 위 다섯 조회 슬라이스가 각각 별도 worktree와 feature commit을 거쳐 순차 병합된다.
- 각 화면의 이전된 조회가 `modules/docs` Application 계약과 browser adapter를 통한다.
- Supabase row와 오류 타입이 이전된 presentation 파일에 노출되지 않는다.
- 기존 UI 표시, 정렬, 필터, pagination, not-found, loading, error 의미가 유지된다.
- 기존 mutation과 Phase 0B 범위는 변경되지 않는다.
- 마지막 production 소비자가 사라진 legacy getter만 interface와 manager에서 제거된다.
- 각 작업의 관련 Jest, ESLint, TypeScript type check, diff check가 통과한다.
- 최종 병합 상태에서 전체 Jest가 통과한다.
- 로드맵의 Phase 4와 진행 상황 표가 실제 완료된 조회 경계를 반영한다.
