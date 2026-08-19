# DDD-lite 데이터 접근 리팩터링 설계

## 개요

현재 Kkuko Utils의 데이터 접근은 `SupabaseClientManager`와 전역 `SCM`을 중심으로 구성되어 있다. 이 구조는 Supabase SDK 사용을 한곳에 모으려는 의도는 있으나, 실제로는 단어, 주제, docs, 사용자, 인증, 알림, 스토리지, 관리자 승인 작업이 하나의 거대한 서비스에 결합되어 있다. 또한 다단계 데이터 변경, 청크 분할, 오류 처리, 결과 가공이 React 컴포넌트와 데이터 매니저 양쪽에 분산되어 있다.

이 설계는 Supabase를 유지하면서 도메인과 애플리케이션 계층에서 Supabase SDK 의존성을 제거하는 DDD-lite 구조를 정의한다. 전체 시스템을 한 번에 다시 작성하지 않고, 데이터 정합성 위험이 가장 큰 `word-moderation` 기능부터 세로 슬라이스로 전환한다. 이후 같은 패턴을 `word-catalog`, `docs`, `identity`, `notifications` 순으로 확장한다.

이 문서에서 `docs`는 프로젝트 도메인 용어인 단어 모음을 뜻하며, 문서가 저장되는 `docs/` 디렉터리와 구분한다.

## 배경과 현재 문제

### Supabase 타입이 상위 계층에 노출됨

`ISupabaseClientManager.ts`는 인터페이스를 제공하지만 반환 타입으로 `PostgrestSingleResponse`, `PostgrestError`, `Session`, 생성된 `Database` 타입을 직접 사용한다. 따라서 호출자는 인터페이스 뒤에 있어도 Supabase의 응답 형태와 오류 모델을 알아야 한다.

이 결합은 다음 문제를 만든다.

- 애플리케이션 테스트가 Supabase 응답 구조를 모방해야 한다.
- 데이터베이스 컬럼 또는 join 표현 변경이 컴포넌트 타입까지 전파된다.
- Supabase 외의 구현이나 서버 API 경계를 도입하기 어렵다.
- 인프라 오류와 사용자에게 보여 줄 업무 오류가 구분되지 않는다.

### CRUD 단위 분리가 도메인 동작을 숨김

현재 API는 `SCM.get()`, `SCM.add()`, `SCM.delete()`, `SCM.update()`처럼 CRUD 동사를 기준으로 나뉜다. 그러나 실제 업무는 `단어 승인`, `단어 요청 반려`, `docs 상세 조회`, `단어 검색`처럼 기능 단위로 실행된다.

하나의 단어 승인 작업이 여러 CRUD 매니저에 걸쳐 있으므로 컴포넌트가 호출 순서와 중간 데이터를 직접 관리한다. 그 결과 UI가 업무 규칙과 트랜잭션 경계를 소유하게 된다.

### 관리자 대량 승인 흐름의 부분 반영 위험

`src/app/admin/add-words/AddWordsHome.tsx`는 다음 작업을 순차적으로 수행한다.

1. docs, 주제, 대기 단어, 주제 변경 요청 조회
2. 입력 데이터를 DB query 형태로 변환
3. 단어 upsert를 청크 단위로 실행
4. 기존 단어와 주제를 다시 조회
5. 단어-주제 관계 추가 및 삭제
6. 단어 로그와 docs 로그 기록
7. 사용자 기여도 갱신
8. docs 수정 시각 갱신
9. 처리한 대기 요청 삭제

후반 작업이 실패하면 앞선 변경은 이미 커밋되어 있을 수 있다. 재시도 시 upsert는 중복을 피할 수 있어도 로그, 기여도, 요청 삭제까지 전체적으로 멱등하다는 보장이 없다.

### 청크와 성능 정책이 분산됨

청크 처리는 `supabaseInQueryChunk`, `SupabaseClientManager` 내부, React 컴포넌트에 각각 존재한다. 청크 크기와 동시성도 호출자가 선택한다. 이 때문에 Supabase/PostgREST의 요청 제한이라는 인프라 지식이 UI로 노출되고, 기능별 재시도와 부분 실패 동작도 달라진다.

### 실행 환경 경계가 불명확함

`src/app/lib/supabaseClient.ts`는 `createBrowserClient`로 전역 클라이언트를 만들지만 일부 Route Handler도 이 전역 `SCM`을 import한다. 반대로 일부 Server Component는 `createSupabaseServerClient`로 직접 쿼리하며, 인증 Route Handler는 service-role 클라이언트를 각 파일에서 다시 생성한다.

브라우저, 사용자 세션이 있는 서버 요청, service-role 서버 작업의 경계와 생성 방식이 통일되어 있지 않다.

### 데이터 접근 외 책임이 매니저에 혼재됨

`SupabaseClientManager`에는 다음 책임이 함께 존재한다.

- Supabase query와 RPC 호출
- 한글 두음법칙과 미션 단어 가공
- 메모리 캐시
- 화면 체감을 위한 최소 2초 지연
- Axios를 통한 내부 API 호출
- 인증 상태 구독
- 스토리지 업로드와 공개 URL 생성
- GitHub API 호출을 포함한 별도 서버 매니저

이 구조에서는 데이터 접근, 도메인 규칙, UX 정책, 외부 API 통합을 독립적으로 테스트하거나 교체하기 어렵다.

## 목표

- React 컴포넌트와 Domain/Application 코드에서 Supabase SDK 타입을 제거한다.
- 기능별 모듈이 명확한 책임과 공개 인터페이스를 갖도록 한다.
- 다단계 mutation을 브라우저에서 단일 Database RPC로 요청하고, DB transaction과 멱등성 기록으로 배치별 원자성 및 전체 작업 재개를 보장한다.
- 기술적 청크 분할, 재시도, DB Row 매핑을 Infrastructure에 둔다.
- UI는 입력, 진행률, 성공/실패 표시만 담당하게 한다.
- 읽기와 쓰기의 모델을 분리하여 조회 화면을 과도한 도메인 모델링 없이 구현한다.
- 전역 `SCM`을 기능별 세로 슬라이스로 점진적으로 대체한다.
- 각 단계에서 현재 사용자 동작과 공개 API를 가능한 한 유지한다.

## 비목표

- Supabase를 다른 데이터베이스나 ORM으로 교체하지 않는다.
- 모든 DB 테이블에 일대일 Repository를 만들지 않는다.
- 모든 데이터를 Entity, Aggregate, Value Object로 모델링하는 Full DDD를 도입하지 않는다.
- Redux에 서버 상태나 데이터베이스 업무 로직을 추가하지 않는다.
- 이번 첫 구현 범위에서 모든 SWR 사용처를 React Query로 일괄 변환하지 않는다.
- `database.types.ts`를 수동 수정하지 않는다.
- 첫 구현에서 `SCM`의 모든 사용처를 제거하지 않는다.
- Kkutu Korea 비공식 API와 미니게임의 기존 IndexedDB 데이터 흐름은 이번 리팩터링 대상에 포함하지 않는다. 단, 대량 승인 작업 재개를 위한 별도 IndexedDB store는 추가한다.

## 설계 원칙

### 기능 단위 세로 슬라이스

코드는 CRUD 동사나 기술 종류가 아니라 업무 기능을 기준으로 나눈다. 각 기능 모듈은 필요한 Domain, Application, Infrastructure 코드를 함께 소유한다.

### 의존성 역전

Domain과 Application은 Supabase, React, Next.js를 import하지 않는다. Application은 필요한 데이터 접근 계약을 port로 정의하고, Infrastructure의 Supabase adapter가 이를 구현한다.

### CQRS-lite

쓰기 작업은 도메인 규칙과 정합성을 중심으로 Repository 또는 전용 transaction port를 사용한다. 읽기 작업은 화면에 맞춘 DTO를 반환하는 Query Service를 사용한다. 조회를 위해 불필요하게 Aggregate를 복원하지 않는다.

### 점진적 대체

새 모듈은 기존 `SCM`을 내부에서 감싸지 않고 독립된 port와 Supabase adapter를 제공한다. 아직 이전하지 않은 기능은 기존 `SCM`을 유지한다. 기능이 이전될 때마다 해당 `SCM` 메서드와 인터페이스를 제거한다.

### 브라우저 직접 요청, DB 권한 보장

RLS로 보호할 수 있는 조회와 mutation은 기능별 브라우저 Supabase adapter가 Data API와 Database RPC를 직접 호출한다. 내부 DB 요청을 전달하기 위한 Next.js Route Handler를 만들지 않는다. 브라우저는 인증 세션을 전달하지만 권한 판단의 주체가 아니다. Database Function은 `auth.uid()`와 DB의 사용자 role을 다시 확인하며, 요청 payload의 사용자 ID를 권한 근거로 사용하지 않는다.

여러 테이블을 변경하는 업무 작업은 브라우저의 여러 Supabase 호출로 조합하지 않는다. 하나의 RPC 호출이 하나의 PostgreSQL transaction이 되도록 하며, 작업이 큰 경우에는 독립적으로 원자적인 배치 여러 개로 나눈다.

## 논리적 Bounded Context

물리적으로는 같은 Supabase schema를 계속 사용하지만, 코드와 소유권은 다음 문맥으로 구분한다.

### `word-catalog`

소유 책임:

- 승인된 단어와 주제 관계
- 단어 검색과 상세 조회
- 시작/끝 글자 통계
- 단어 다운로드용 read model

대표 데이터는 `words`, `themes`, `word_themes`, 글자 통계와 단어 검색 RPC다.

### `word-moderation`

소유 책임:

- 단어 추가/삭제 요청
- 단어-주제 변경 요청
- 승인과 반려 상태 전이
- 승인 작업의 로그와 멱등성
- 대량 승인/import 작업

대표 데이터는 `wait_words`, `wait_word_themes`, `word_themes_wait`, `logs`와 승인/반려 transaction RPC다.

`word-moderation`은 승인 결과로 `word-catalog`, `docs`, `identity` 데이터를 변경해야 한다. 이 변경은 UI가 각 context를 직접 호출하지 않고 moderation application use case가 명시적인 port를 통해 조정한다.

### `docs`

소유 책임:

- 단어 모음 정보와 조회
- 즐겨찾기
- 조회수와 최근 수정 시각
- docs별 변경 로그 read model

대표 데이터는 `docs`, `docs_wait`, `user_star_docs`, `docs_logs`다.

### `identity`

소유 책임:

- Supabase Auth 세션과 OAuth
- Kkuko Utils 사용자 프로필
- 닉네임 변경
- 기여도 반영

Auth SDK 상태 구독은 브라우저 Infrastructure에 남을 수 있지만, DB 사용자 조회와 변경은 별도 application service를 거친다.

### `notifications`

공지 목록과 상세 조회, 관리자 공지 작성·수정·삭제, 활성 modal 공지 조회를 소유한다.

### `programs`

등록 프로그램 정보와 GitHub release 외부 연동을 소유한다. GitHub API는 Supabase adapter와 분리된 `GitHubReleaseGateway`로 취급한다.

## 목표 아키텍처

```text
Presentation
  Client Component / Server Component / React Query Hook
      |
      v
Application
  Use Case / Command Handler / Query Service Port / Repository Port
      |
      v
Domain
  Entity / Value Object / Policy / Domain Error

Infrastructure
  Browser/Server Supabase Adapter / IndexedDB Job Store / GitHub Gateway / Row Mapper
      |
      v
Supabase DB, Auth, Storage, External API
```

Infrastructure는 Application이 정의한 port를 구현한다. Client Component는 browser composition root, Server Component는 server composition root를 통해 구체 adapter가 주입된 use case를 받는다. Route Handler는 OAuth callback이나 외부 secret이 필요한 통합처럼 브라우저에서 직접 수행할 수 없는 경계에만 사용한다.

### 의존성 규칙

- `domain/**`은 프로젝트 내부의 다른 계층과 외부 프레임워크를 import하지 않는다.
- `application/**`은 같은 모듈의 domain과 application 공통 타입만 import한다.
- `infrastructure/**`은 domain/application과 생성된 DB 타입을 import할 수 있다.
- `app/**`은 application의 command/query와 presentation adapter를 사용한다.
- `app/**`에서 `@supabase/supabase-js`, `@supabase/ssr`, `database.types.ts`를 직접 import하지 않는다. Browser/server Supabase composition root와 인증 callback 같은 명시된 경계 파일만 예외로 한다.
- 다른 bounded context의 Infrastructure를 직접 import하지 않는다. context 간 협력은 Application port를 사용한다.

## 권장 디렉터리 구조

```text
src/
  modules/
    word-catalog/
      domain/
        word.ts
        word-policy.ts
        word-errors.ts
      application/
        get-word-detail.ts
        search-words.ts
        word-query.ts
      infrastructure/
        supabase-word-query.ts
        word-row-mapper.ts
      index.ts

    word-moderation/
      domain/
        word-request.ts
        approval-policy.ts
        moderation-errors.ts
      application/
        approve-word-batch.ts
        reject-word-requests.ts
        get-approval-context.ts
        ports.ts
      infrastructure/
        browser/
          supabase-word-moderation-gateway.ts
          word-approval-job-db.ts
        moderation-row-mapper.ts
      index.ts

    docs/
    identity/
    notifications/
    programs/

  shared/
    application/
      result.ts
      application-error.ts
    infrastructure/
      supabase/
        browser-client.ts
        server-client.ts
        service-client.ts
        chunk-executor.ts
        map-supabase-error.ts

  app/
    api/
    admin/
    word/
    words-docs/
```

각 모듈의 `index.ts`는 외부에 공개할 application API와 presentation용 타입만 export한다. DB Row 타입과 Supabase adapter는 모듈 외부로 export하지 않는다.

## 데이터 계약

### 애플리케이션 결과

Application은 Supabase 응답을 반환하지 않고 명시적인 결과를 반환한다.

```ts
export type ApplicationError =
    | { kind: 'validation'; message: string; field?: string }
    | { kind: 'unauthorized'; message: string }
    | { kind: 'forbidden'; message: string }
    | { kind: 'not-found'; message: string }
    | { kind: 'conflict'; message: string; code?: string }
    | { kind: 'infrastructure'; message: string; cause?: unknown };

export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: ApplicationError };
```

Infrastructure는 `PostgrestError`, `AuthError`, `StorageError`를 `ApplicationError`로 변환한다. 원본 오류는 서버 로그에 남길 수 있지만 Client Component에 그대로 직렬화하지 않는다.

### Command와 DTO

Command는 사용자의 의도를 표현하며 DB insert 타입을 그대로 사용하지 않는다.

```ts
export interface ApproveWordBatchCommand {
    operationId: string;
    batchIndex: number;
    totalBatches: number;
    payloadHash: string;
    entries: Array<{
        word: string;
        themeCodes: string[];
    }>;
}

export interface ApproveWordBatchResult {
    approvedWordCount: number;
    addedThemeCount: number;
    removedThemeCount: number;
    processedRequestCount: number;
    affectedDocsIds: number[];
}
```

`actorId`와 관리자 여부는 command에 넣지 않는다. Database Function이 Supabase Auth JWT의 `auth.uid()`와 `public.users.role`을 조회해 최종 권한을 판정한다. 브라우저 application은 로그인 여부를 미리 확인해 빠른 UX 피드백만 제공한다. 조회 DTO는 화면 요구에 맞게 별도로 정의하며, 생성된 `Database` Row 타입은 Infrastructure mapper 안에서만 사용한다.

### 작업 생명주기 port

Application은 operation 생성, 상태 조회, 배치 실행과 취소만 알며 RPC 이름과 IndexedDB schema를 알지 않는다.

```ts
export interface WordApprovalOperationGateway {
    startOperation(input: {
        operationId: string;
        inputHash: string;
        totalEntries: number;
        totalBatches: number;
    }): Promise<Result<WordApprovalOperation>>;
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

새 작업은 다음 순서로 시작한다.

1. Domain/Application이 입력을 검증하고 결정적인 순서로 정규화한다.
2. Browser Infrastructure가 전체 input hash와 각 batch payload hash를 계산한다.
3. `crypto.randomUUID()`로 `operationId`를 만들고 IndexedDB에 payload를 저장한다.
4. `startOperation` RPC로 DB operation을 생성한다.
5. DB 생성이 성공하면 첫 batch부터 순차 실행한다.

같은 `operationId`의 시작 요청이 재전송되면 소유자, input hash, 전체 항목 수와 배치 수가 모두 같을 때 기존 operation을 반환한다. 하나라도 다르면 conflict를 반환한다.

## Supabase 클라이언트 경계

### Browser client

- OAuth 시작과 인증 상태 구독에 사용한다.
- RLS로 보호되는 일반 조회는 기능별 browser query adapter를 통해 직접 실행한다.
- 여러 테이블을 변경하는 관리자 작업은 기능별 gateway가 단일 Database RPC로 호출한다.
- 각 RPC에는 현재 로그인 세션의 JWT가 전달되며 DB가 `auth.uid()`를 기준으로 권한을 다시 판정한다.
- 테이블별 mutation을 브라우저에서 순차 조합하지 않는다.
- 모듈 전역 `SCM`을 제공하지 않는다.

### Session-aware server client

- Server Component와 필요한 Route Handler에서 요청별 cookie와 세션을 사용한다.
- SSR/metadata 조회와 브라우저에서 수행할 수 없는 서버 전용 작업에 사용한다.
- 요청마다 생성하며 사용자별 상태를 module singleton에 저장하지 않는다.

### Service-role server client

- `server-only` 경계에서만 생성한다.
- 관리자 대량 승인 흐름에는 사용하지 않는다.
- 외부 secret 통합이나 운영 작업처럼 RLS를 의도적으로 우회해야 하는 예외에만 사용한다.
- 브라우저 bundle로 import될 수 있는 파일에서 export하지 않는다.
- Route Handler마다 직접 생성하지 않고 하나의 factory를 사용한다.

## Composition Root

구체 구현 생성을 컴포넌트나 페이지에 흩어 놓지 않는다. 기능별 browser/server composition root가 실행 환경에 맞는 use case를 조립한다.

```text
createBrowserWordModerationServices()
  -> use singleton browser Supabase client
  -> create IndexedDB WordApprovalJobStore
  -> create SupabaseWordModerationGateway
  -> create ApproveWordBatch use case
```

브라우저 composition root의 Supabase client singleton은 연결과 인증 세션만 공유한다. 사용자별 업무 cache와 진행 상태는 React Query 및 IndexedDB에 저장한다. Server Component 조회는 별도의 request-scoped server composition root를 사용한다.

## 조회 흐름

### Server Component 조회

```text
Server Component
  -> server composition root
  -> application query
  -> Supabase query adapter
  -> read DTO
  -> Component props
```

Server Component는 Supabase query builder를 직접 작성하지 않는다. `generateMetadata`처럼 일부 필드만 필요한 경우에도 작은 query 또는 동일 query service의 projection 메서드를 사용한다.

### Client Component 조회

```text
Client Component
  -> feature React Query hook
  -> application query
  -> browser Supabase query adapter
  -> Supabase Data API / RPC
```

React Query hook은 query key, stale time, retry와 application result 처리를 소유한다. 브라우저 query adapter가 Supabase 응답과 DB 오류를 DTO 및 `ApplicationError`로 변환하므로 컴포넌트는 query builder와 DB 오류 형태를 알지 않는다.

기존 SWR 사용처는 해당 기능을 이전할 때 React Query로 전환한다. Kkutu 외부 API처럼 이미 독립된 흐름은 별도 리팩터링 요청이 없는 한 유지한다.

## Mutation 흐름

```text
Client Component
  -> feature mutation hook
  -> application command handler
  -> browser Supabase gateway
  -> authenticated Database RPC
  -> DB authorization and transaction
  -> invalidate affected query keys
```

Presentation은 파일 선택과 기본 형식 검사, 진행 단계 표시, command 전송, 성공 요약 또는 프로젝트 Modal을 통한 오류 표시, 완료 후 cache 무효화만 담당한다. 단어, 주제, 로그, 기여도, 대기 요청 삭제 순서를 직접 제어하지 않는다. 브라우저 application은 배치 실행과 재개를 조정하지만 실제 권한과 원자성은 DB가 보장한다.

## 대량 승인과 트랜잭션 설계

### 업무 원자성

하나의 승인 배치에서 다음 변경은 함께 성공하거나 함께 실패해야 한다.

- 단어 upsert
- 단어-주제 관계 추가/삭제
- 승인된 대기 요청 및 주제 요청 제거
- 단어 로그와 docs 로그 생성
- 사용자 기여도 반영
- 영향받은 docs의 `last_update` 갱신

Supabase adapter는 이 작업을 PostgreSQL transaction 안에서 수행하는 전용 RPC를 호출한다. Application command handler는 RPC 이름이나 table 구조를 알지 않는다.

### 큰 입력의 배치 의미

모든 입력을 하나의 거대한 DB transaction으로 처리하지 않는다. Application은 사용자 관점의 전체 작업을 `operationId`로 식별하고, browser Infrastructure는 정규화된 입력을 결정적인 순서로 정렬한 뒤 설정된 최대 크기의 원자적 배치로 나눈다. Database Function은 배치 항목 수의 상한을 다시 검사하므로 변조된 클라이언트가 과도한 payload를 실행할 수 없다.

- 청크 크기는 browser Infrastructure 설정이며 DB가 최대값을 강제한다.
- mutation 배치는 lock 경쟁과 처리 순서 혼란을 줄이기 위해 기본적으로 순차 실행한다.
- 각 배치는 `operationId`와 `batchIndex`로 멱등하게 처리한다.
- 각 배치는 정규화 payload의 SHA-256 `payloadHash`를 전달한다.
- 이미 성공한 배치를 재전송하면 중복 로그나 기여도가 생성되지 않는다.
- 배치 하나는 원자적으로 성공하거나 실패한다.
- 전체 작업이 일부 배치까지 완료된 경우 DB의 operation 조회 결과가 완료된 batch index를 반환한다.
- 사용자는 같은 `operationId`로 실패 지점부터 재개할 수 있다.

초기 구현은 Route Handler, Server Action, background worker를 사용하지 않는다. Browser feature gateway가 Supabase Database RPC를 직접 호출하고 진행률을 갱신한다. Vercel Function은 대량 승인 요청 경로에 포함되지 않는다.

브라우저가 닫히거나 새로고침되어도 같은 브라우저에서 재개할 수 있도록 정규화 입력, `operationId`, 배치 크기와 전체 input hash를 IndexedDB에 저장한다. IndexedDB 데이터가 없으면 사용자가 원본 파일을 다시 선택해야 하며, 전체 input hash가 일치할 때만 기존 operation을 재개한다.

### Operation과 배치 상태

DB는 전체 작업과 완료된 배치를 별도 테이블로 기록한다.

```text
word_approval_operations
  id uuid primary key
  requested_by uuid not null
  input_hash text not null
  total_entries integer not null
  total_batches integer not null
  completed_batches integer not null
  status running | completed | cancelled
  created_at timestamptz not null
  updated_at timestamptz not null
  completed_at timestamptz null

word_approval_batches
  operation_id uuid not null
  batch_index integer not null
  payload_hash text not null
  entry_count integer not null
  result jsonb not null
  committed_at timestamptz not null
  primary key (operation_id, batch_index)
```

배치 RPC는 다음 순서로 실행한다.

1. `auth.uid()`로 호출자를 확인한다.
2. `public.users.role = 'admin'`인지 DB에서 검사한다.
3. operation이 호출자 소유이고 `running` 상태인지 확인한다.
4. operation row를 잠가 같은 operation의 동시 처리를 직렬화한다.
5. 같은 `batchIndex`의 완료 기록을 조회한다.
6. 완료 기록과 `payloadHash`가 같으면 기존 결과를 반환한다.
7. 완료 기록과 `payloadHash`가 다르면 conflict로 중단한다.
8. 영향받는 요청과 단어 row를 잠그고 업무 변경을 set-based SQL로 처리한다.
9. 배치 결과를 `word_approval_batches`에 기록한다.
10. 마지막 배치까지 완료되면 operation을 `completed`로 변경한다.

함수 호출 하나가 하나의 PostgreSQL transaction이므로 8~10번 중 오류가 발생하면 해당 배치의 업무 변경과 완료 기록이 함께 rollback된다. 실패 기록을 같은 transaction에 남기지 않으며, 완료 레코드가 없는 batch를 재시도 대상으로 본다.

### IndexedDB 작업 저장소

`word-approval-job-db.ts`는 같은 브라우저에서 작업을 재개하기 위한 payload를 보관한다.

```ts
export interface StoredWordApprovalJob {
    operationId: string;
    inputHash: string;
    entries: NormalizedWordApprovalEntry[];
    batchSize: number;
    createdAt: string;
}
```

IndexedDB의 완료 상태는 권위 있는 데이터가 아니다. 재개 시 application은 먼저 DB operation을 조회하고, DB가 반환한 완료 batch index와 로컬 payload hash를 대조한 후 미완료 배치만 실행한다. 완료된 operation의 로컬 payload는 결과 확인 후 삭제한다.

### 진행률

```ts
export type ApprovalProgress = {
    completedEntries: number;
    totalEntries: number;
    completedBatches: number;
    totalBatches: number;
    stage: 'validating' | 'applying' | 'finalizing' | 'completed';
};
```

UI 문구는 Presentation에서 결정하며 Infrastructure가 React state callback을 받지 않는다.

## 청크 실행기

`shared/infrastructure/supabase/chunk-executor.ts`는 조회용 기술 청크를 제공한다. `word-moderation` mutation 배치는 operation과 payload hash 의미가 있으므로 전용 batch executor가 담당한다.

- 빈 입력은 즉시 빈 결과를 반환한다.
- 기본 청크 크기와 최대 동시성은 Infrastructure 설정으로 제한한다.
- 실패 시 성공 결과를 전체 성공처럼 반환하지 않는다.
- `continueOnError` 같은 boolean 대신 `fail-fast` 또는 `collect-errors` 정책을 명시한다.
- 배치 index와 원본 입력 위치를 보존한다.
- 조회 재시도는 transient 오류에만 제한하고 지수 backoff와 최대 횟수를 둔다.
- 업무 mutation에는 멱등성 키가 없는 자동 재시도를 하지 않는다.

Mutation batch executor는 `operationId`, `batchIndex`, `payloadHash`가 있는 요청만 재시도한다. 재개 전에는 DB 완료 상태를 다시 조회한다.

## 도메인 규칙의 위치

다음 규칙은 순수 함수 또는 policy로 이동한다.

- 단어와 주제 코드 입력 정규화
- `k_canuse`, `noin_canuse` 결정 규칙
- 기존 주제와 요청 주제의 차이 계산
- 승인/반려 가능한 요청 상태
- 기여도 증가량 계산
- docs 변경 대상 계산

두음법칙, 미션 글자, 단어 선택 같은 조회용 계산은 `word-catalog`의 domain policy 또는 application projection helper에 둔다. Supabase adapter는 DB Row를 읽고 쓰는 일과 mapper 호출만 담당한다.

## 캐시와 서버 상태

- 브라우저 서버 상태의 기본 도구는 React Query로 통일한다.
- query key는 각 feature hook이 export한다.
- mutation 성공 시 영향받은 feature query만 무효화한다.
- Server Component cache는 Next.js의 request/cache semantics를 명시적으로 사용한다.
- 사용자별 데이터나 mutable 객체를 module-level singleton cache에 저장하지 않는다.
- 현재 `SupabaseClientManager`의 메모리 캐시는 기능 이전 시 React Query, Next cache 또는 명시적 server cache로 대체한다.
- 같은 데이터를 SWR와 React Query 양쪽에서 동시에 캐시하지 않는다.

## 인증과 권한

- 브라우저의 Redux role은 UI 접근 제어와 빠른 피드백에만 사용하며 보안 근거로 신뢰하지 않는다.
- Database Function은 `auth.uid()`로 호출자를 식별하고 `public.users.role = 'admin'`을 직접 확인한다.
- `processed_by`, `added_by`, 기여도 대상은 DB가 현재 actor와 대기 요청 데이터로 계산한다.
- 사용자가 제출한 UUID를 권한 또는 감사 로그의 actor로 그대로 사용하지 않는다.
- `public`과 `anon`에는 승인 RPC 실행 권한을 부여하지 않고 `authenticated`에만 명시적으로 `EXECUTE`를 부여한다.
- 관련 테이블의 브라우저 직접 mutation 권한은 가능한 한 제거하고 승인 RPC만 노출한다.
- 노출된 `public` RPC는 입력 크기와 형식을 검사하는 `SECURITY INVOKER` wrapper로 둔다. 실제 다중 테이블 변경은 Data API에 노출되지 않은 schema의 `SECURITY DEFINER` 함수가 수행한다.
- Private definer 함수는 `search_path = ''`, schema-qualified relation, 함수 내부 관리자 재검증과 최소 실행 권한을 적용한다. `public`, `anon`에는 wrapper와 private 함수 실행 권한을 부여하지 않는다.
- service-role key는 브라우저에서 절대 사용하지 않으며 관리자 승인 흐름에도 사용하지 않는다.
- RLS와 RPC 내부 권한 검사를 함께 사용한다.

## 오류 처리와 관측성

Browser Supabase adapter는 PostgREST 및 Database Function 오류 code를 `ApplicationError.kind`로 변환한다. 권한 오류는 `unauthorized` 또는 `forbidden`, payload hash 충돌은 `conflict`, DB/network 장애는 `infrastructure`로 매핑한다.

Client Component에는 안정적인 오류 kind, code와 사용자용 message만 전달한다. DB query와 내부 함수 stack은 console 또는 Modal에 그대로 노출하지 않는다. DB 함수는 안전한 공개 오류 code만 반환하고 상세 오류는 Supabase DB 로그에서 확인한다.

대량 작업 로그에는 `operationId`, `batchIndex`, `actorId`, `entryCount`, `durationMs`, 결과와 내부 오류 code를 포함한다. Application 결과가 성공인데 일부 필수 side effect가 실패하는 상태는 허용하지 않는다.

## DB schema와 migration 관리

새 RPC, 멱등성 제약, 보조 테이블, RLS 변경은 Supabase migration으로 저장소에 버전 관리한다. 원격 schema를 먼저 임의 수정한 뒤 코드만 맞추는 방식을 피한다.

대량 승인에는 최소한 다음 DB 계약이 필요하다.

- 승인 transaction RPC
- `word_approval_operations`와 `word_approval_batches` 테이블
- `operation_id + batch_index` 중복 실행을 막는 primary key
- operation input hash와 batch payload hash 검증
- 로그 중복 방지를 위한 명시적 idempotency 정책
- `auth.uid()`와 `users.role`을 사용하는 관리자 검증
- `public`/`anon` revoke와 `authenticated` grant를 포함한 RPC 실행 권한
- operation 및 영향받은 요청 row의 동시성 제어
- 실패 시 전체 배치 rollback

Migration 적용 후 `npm run gen-type`으로 `src/app/types/database.types.ts`를 재생성한다. 생성 파일은 직접 수정하지 않는다.

## 테스트 전략

### Domain unit test

- 단어 입력 정규화
- `noin_canuse`와 사용 가능 상태 계산
- 기존/요청 주제 차이 계산
- 기여도와 docs 영향 범위 계산
- 잘못된 요청 상태 전이 거부
- 같은 입력에서 결정적인 결과 생성

### Application unit test

Supabase mock 대신 port의 작은 fake를 사용한다.

- 관리자가 아닌 actor의 승인 거부
- 빈 입력과 중복 단어 검증
- 승인 transaction 성공 결과 집계
- 특정 배치 실패 시 이후 처리 중단 및 재개 정보 반환
- 같은 `operationId` 재실행 시 중복 side effect 방지
- 완료된 batch index를 건너뛰고 첫 미완료 배치부터 재개
- DB 완료 상태와 로컬 payload hash 불일치 시 conflict 반환
- Infrastructure 오류가 애플리케이션 오류로 보존됨

### Infrastructure integration test

로컬 Supabase 또는 격리된 테스트 DB를 사용한다.

- Row mapper가 nullable join을 올바르게 처리
- RPC 성공 시 관련 테이블이 함께 변경됨
- RPC 중간 오류 시 전체 배치 rollback
- 같은 idempotency key 재호출 시 로그와 기여도 중복 없음
- 같은 batch index에 다른 payload hash를 보내면 conflict
- RPC 내부에서 `auth.uid()`와 DB role이 검증됨
- RLS 및 RPC 권한이 일반 사용자와 관리자에게 올바르게 적용됨
- 동시 호출이 operation 및 영향 row lock 정책을 준수함
- 청크 조회가 입력 순서와 전체 결과를 보존

### Browser adapter/Component test

- 인증되지 않은 사용자의 RPC 오류가 `unauthorized`로 매핑됨
- 일반 사용자의 관리자 RPC 오류가 `forbidden`으로 매핑됨
- validation 오류가 안정적인 응답 형식으로 반환됨
- 승인 화면이 command만 전송하고 Supabase SDK를 직접 호출하지 않음
- 진행률과 재시도/재개 UI가 올바르게 표시됨
- 새로고침 후 IndexedDB 작업과 DB 완료 배치를 대조해 재개함
- IndexedDB가 없을 때 같은 input hash의 파일만 재개를 허용함
- 오류는 프로젝트 Modal을 통해 표시됨

### 회귀 검증

- 기존 단어 검색, docs 조회, 관리자 승인 결과가 유지됨
- `npm run lint`
- `npx tsc --noEmit`
- 관련 Jest 테스트
- DB/RPC 변경이 포함된 단계에서는 `npm run build`

## 점진적 이행 계획

### 1단계: 안전망과 공통 경계

- 현재 대량 승인 결과를 고정하는 characterization test 추가
- 공통 `Result`와 `ApplicationError` 정의
- browser/session/service Supabase client factory 분리
- Supabase 오류 mapper 추가
- 새 코드의 금지 import 규칙 정의

이 단계에서는 사용자 동작을 변경하지 않는다.

### 2단계: `word-moderation` 순수 규칙 추출

- `AddWordsHome`의 데이터 정규화와 차이 계산을 domain policy로 이동
- 승인 command와 result 정의
- application port와 fake 기반 unit test 추가
- UI 진행 상태를 feature hook으로 분리

DB 호출은 아직 기존 구현을 사용하더라도 domain/application 테스트는 Supabase 없이 실행 가능해야 한다.

### 3단계: 브라우저 직접 RPC와 원자적 배치

- operation/batch 상태, 승인 transaction과 idempotency migration 추가
- 브라우저 Supabase approval gateway 구현
- IndexedDB approval job store 구현
- DB 함수 내부 `auth.uid()` 및 관리자 authorization 추가
- RPC revoke/grant와 관련 RLS 정책 추가
- UI의 직접 `SCM.add/delete/update` 호출 제거
- DB 완료 상태와 IndexedDB payload를 이용한 실패 배치 재개 흐름 추가

이 단계가 완료되면 대량 승인 컴포넌트는 DB query 순서, table 구조와 RPC 이름을 알지 않는다. 대량 승인 경로에는 Next.js Route Handler, Server Action과 Vercel Function이 존재하지 않는다.

### 4단계: `word-catalog` query 분리

- 단어 검색, 상세, 주제 목록을 Query Service로 이동
- RPC 결과와 화면 DTO 사이 mapper 추가
- `api/words/search`의 browser SCM import 제거
- 관련 Client Component를 React Query feature hook으로 통일
- 기존 manager의 대응 메서드 제거

### 5단계: 나머지 context 이전

위험도와 변경 빈도에 따라 `docs`, `identity`, `notifications`, `programs` 순으로 진행한다. 각 context는 별도 구현 계획과 테스트 범위를 갖는다. 한 context가 완전히 이전되기 전까지 다른 context의 관련 코드를 함께 리팩터링하지 않는다.

### 6단계: 기존 데이터 매니저 제거

- 모든 `SCM` import 제거 확인
- `ISupabaseClientManager.ts` 제거
- `SupabaseClientManager.ts` 제거
- 사용하지 않는 `supabase.types.ts` 정리
- SWR/React Query 중복 cache 확인
- Architecture import rule을 CI에서 검증

## 첫 구현 계획의 범위

이 설계 전체를 한 번에 구현하지 않는다. 이 문서 승인 후 작성할 첫 구현 계획은 다음만 포함한다.

- 1단계 공통 경계와 테스트 안전망
- 2단계 `word-moderation` 규칙 및 use case 추출
- 3단계 브라우저 직접 RPC와 재개 가능한 원자적 배치 처리

`word-catalog`, `docs`, `identity`, `notifications`, `programs` 이전은 첫 구현 결과를 검증한 뒤 각각 별도 계획으로 작성한다.

## 수용 기준

첫 구현 범위는 다음 조건을 모두 만족할 때 완료된다.

- `AddWordsHome`에서 Supabase SDK, `SCM`, `supabaseInQueryChunk`를 import하지 않는다.
- 컴포넌트는 승인 command와 진행률만 다룬다.
- 브라우저 gateway가 Next.js `/api`를 거치지 않고 Supabase Database RPC를 직접 호출한다.
- 승인 actor는 RPC 내부에서 `auth.uid()`와 DB의 `users.role`로 인증·인가된다.
- 하나의 원자적 배치 안에서 단어, 주제, 로그, 기여도, 대기 요청 변경이 함께 commit 또는 rollback된다.
- 같은 operation/batch를 재실행해도 로그와 기여도가 중복되지 않는다.
- 같은 batch index의 payload hash가 다르면 변경 없이 conflict가 반환된다.
- 새로고침 후 DB 완료 상태와 IndexedDB payload를 대조해 첫 미완료 배치부터 재개된다.
- 대량 승인 흐름이 Vercel Function 실행시간 제한에 의존하지 않는다.
- Domain/Application 테스트는 Supabase mock 없이 실행된다.
- Supabase 생성 타입은 Infrastructure 바깥으로 노출되지 않는다.
- 오류가 `ApplicationError`로 변환되고 UI에는 안정적인 message/code만 전달된다.
- 기존 관리자 승인 결과와 진행률 UI의 핵심 동작이 유지된다.
- lint, TypeScript 검사, 관련 테스트, build가 통과한다.

## 위험과 대응

### DB transaction RPC가 커질 위험

RPC는 SQL 문자열 생성이나 화면용 가공을 담당하지 않고 원자적 변경과 멱등성만 담당한다. 입력 검증과 업무 결과 계산은 Application/Domain에 둔다.

### 추상화 파일만 늘어날 위험

테이블별 Repository를 만들지 않는다. 실제 use case가 요구하는 port만 추가하며, 단순 조회는 Query Service로 구현한다.

### 이중 구조가 오래 유지될 위험

각 migration PR은 새 경로 추가뿐 아니라 대체된 `SCM` 메서드와 import 제거를 완료 조건으로 둔다. 신규 기능은 기존 `SCM`에 메서드를 추가하지 않는다.

### 동작 변화와 리팩터링이 섞일 위험

각 단계는 characterization test를 먼저 추가하고 공개 UI와 API 동작을 유지한다. 승인 정책 자체를 바꾸는 요구는 별도 기능 변경으로 처리한다.

### 대량 작업의 실행 시간 위험

원자적 배치 크기를 browser Infrastructure에서 보수적으로 설정하고 Database Function이 최대 항목 수를 검증한다. RPC 실행시간을 측정해 다음 작업의 기본 배치 크기를 조정할 수 있지만, 한 operation 안에서는 배치 크기를 바꾸지 않는다. Supabase/PostgREST 및 PostgreSQL timeout이 발생해도 operation 단위로 재개한다.

### 브라우저 종료와 로컬 데이터 손실 위험

정규화 payload와 operation metadata를 IndexedDB에 저장한다. IndexedDB가 삭제되면 동일한 input hash를 가진 원본 파일을 다시 선택해야 재개할 수 있다. DB는 완료된 배치와 결과만 권위 있게 관리하며 미완료 payload 전체를 보관하지 않는다.

## 결정 사항

- DDD-lite와 CQRS-lite를 함께 사용한다.
- 첫 migration 대상은 `word-moderation`의 관리자 대량 승인 흐름이다.
- Supabase는 Infrastructure adapter로 유지한다.
- 생성된 DB 타입과 Supabase 오류 타입은 Infrastructure 밖으로 노출하지 않는다.
- RLS로 보호되는 클라이언트 조회는 browser Supabase adapter가 직접 실행한다.
- 관리자 대량 승인 mutation은 browser Supabase gateway가 단일 Database RPC로 직접 실행하며 Next.js `/api`를 거치지 않는다.
- 대량 승인은 원자적이고 멱등한 배치로 처리하며 전체 operation은 재개 가능하게 한다.
- 재개 payload는 IndexedDB, 완료 상태와 권한 판정은 DB를 진실의 원천으로 사용한다.
- Vercel Function 실행시간을 대량 승인 처리의 정확성 또는 완료 조건으로 사용하지 않는다.
- Client 서버 상태의 기본 도구는 React Query로 한다.
- 기존 `SCM`은 big-bang으로 제거하지 않고 context별로 점진 제거한다.
- Full DDD, ORM 도입, 모든 기능의 동시 이전은 하지 않는다.
