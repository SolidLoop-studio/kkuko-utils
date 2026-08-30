# 관리자 docs 요청 moderation DDD-lite 전환 설계

## 개요

`admin/request-docs` 화면의 승인 동작은 현재 브라우저에서 `docs` insert와
`docs_wait` delete를 순서대로 호출한다. 첫 호출이 성공하고 두 번째 호출이 실패하면
문서는 생성되지만 요청은 대기열에 남는 부분 성공 상태가 발생한다. 반려 또한 UI가
Supabase CRUD facade를 직접 호출하며 Supabase 오류 타입을 화면까지 노출한다.

이번 작업은 관리자 docs 생성 요청의 승인·반려 mutation만 `docs` bounded context의
DDD-lite 세로 슬라이스로 이전한다. 요청 목록 조회는 이번 범위에 포함하지 않고 기존
`RequestDocsWrapper`와 `SCM.get().addWaitDocs()` 경로를 유지한다.

## 목표

- 승인 시 docs 생성과 대기 요청 삭제를 하나의 PostgreSQL transaction으로 처리한다.
- 반려 시 선택된 요청을 하나의 원자적 command로 처리한다.
- Domain과 Application에서 Supabase, React, Next.js, 생성 DB 타입을 제거한다.
- `RequestDocsHome`이 table, RPC 이름, Supabase 오류를 알지 않게 한다.
- 관리자 권한과 입력 제약을 Application뿐 아니라 Database Function에서도 검증한다.
- 한 번에 처리할 요청을 최대 30개로 제한한다.
- 대체된 `SCM.add().docs`와 `SCM.delete().waitDocsByIds`를 제거한다.

## 비목표

- `RequestDocsWrapper`의 요청 목록 조회를 이전하지 않는다.
- docs 목록·상세·즐겨찾기·조회 수 등 Phase 4 조회 기능을 이전하지 않는다.
- 하드코딩된 reference docs ID나 기존 word trigger를 변경하지 않는다.
- operation table, IndexedDB payload, 중단 후 재개 기능을 추가하지 않는다.
- 원격 Supabase project에 migration을 직접 적용하지 않는다.
- `database.types.ts`를 수동으로 수정하지 않는다.

## 현재 동작과 보존할 의미

승인은 선택된 `docs_wait` 요청마다 다음 docs row를 만든다.

- `name`: 대기 요청의 `docs_name`
- `maker`: 대기 요청의 `req_by`
- `duem`: 관리자가 화면에서 선택한 값
- `typez`: 항상 `letter`

현재 `docs` insert는 선택 전체를 한 statement로 실행하고, 성공한 경우에만 선택된
`docs_wait` row를 삭제한다. 새 RPC도 선택 묶음을 all-or-nothing으로 처리한다. 하나의
요청이 이미 처리되었거나 docs 이름이 충돌하면 나머지 항목까지 포함해 전체 작업을
rollback한다.

반려는 선택된 `docs_wait` row를 삭제한다. 승인과 반려 모두 성공 후 첫 페이지로
돌아가며 처리된 요청, 선택 상태, 해당 두음 설정을 화면에서 제거한다. 실패 시 목록과
선택 상태를 유지한다.

## 아키텍처

새 코드는 `src/modules/docs`에 둔다.

```text
src/modules/docs/
  domain/
    docs-request-moderation.ts
  application/
    docs-request-moderation-types.ts
    docs-request-moderation-ports.ts
    moderate-docs-requests.ts
  infrastructure/browser/
    browser-docs-services.ts
    supabase-docs-request-moderation-gateway.ts
  presentation/
    use-docs-request-moderation.ts
  index.ts
```

의존성 방향은 다음과 같다.

```text
RequestDocsHome
  -> useDocsRequestModeration
  -> ModerateDocsRequestsService
  -> DocsRequestModerationGateway
  -> Supabase RPC adapter
  -> approve_docs_requests / reject_docs_requests
```

Domain은 command 검증과 결정적 정렬만 담당한다. Application service는 정규화한
command를 작은 gateway port에 전달한다. Infrastructure adapter만 RPC 이름, payload,
Supabase 오류를 알고, presentation hook은 React Query mutation 상태와 안정적인
`ApplicationError`를 UI에 제공한다.

## Application 계약

승인 입력은 다음 형태다.

```ts
type ApproveDocsRequestsCommand = {
    selections: Array<{
        requestId: number;
        duem: boolean;
    }>;
};
```

반려 입력은 다음 형태다.

```ts
type RejectDocsRequestsCommand = {
    requestIds: number[];
};
```

공통 성공 결과는 실제 DB에서 처리된 요청만 나타낸다.

```ts
type DocsRequestModerationResult = {
    processedRequestIds: number[];
    processedRequestCount: number;
};
```

Domain은 다음을 검증한다.

- 입력 배열이어야 한다.
- 항목 수는 1개 이상 30개 이하여야 한다.
- 요청 ID는 양의 안전한 정수여야 한다.
- 요청 ID가 중복되면 validation 오류다.
- 승인 `duem`은 boolean이어야 한다.
- 정규화 결과는 요청 ID 오름차순이다.

중복 ID를 자동 제거하지 않는다. 호출자의 잘못을 감춰 입력과 실제 처리 건수가
달라지는 것을 방지하기 위해 명시적인 validation 오류를 반환한다.

## Database RPC 설계

두 개의 public RPC를 추가한다.

- `public.approve_docs_requests(p_selections jsonb)`
- `public.reject_docs_requests(p_request_ids jsonb)`

두 함수는 `SECURITY DEFINER`, `search_path = ''`로 정의한다. `PUBLIC`과 `anon`의
실행 권한을 revoke하고 `authenticated`에만 execute를 grant한다. 함수 내부에서
`auth.uid()`를 조회하고 `public.users.role = 'admin'`을 다시 검증한다.

승인 RPC는 다음 순서로 실행한다.

1. 인증·관리자 권한을 검증한다.
2. payload shape, 1~30개 제한, 안전한 양의 정수 ID, boolean `duem`, 중복 ID를 검증한다.
3. 선택된 `public.docs_wait` row를 요청 ID 오름차순으로 `FOR UPDATE` 잠근다.
4. 잠긴 row 수가 입력 수와 다르면 conflict로 실패한다.
5. `docs_wait.docs_name`, `docs_wait.req_by`, payload의 `duem`, 상수 `letter`를 사용해
   `public.docs` row를 생성한다.
6. 선택된 `docs_wait` row를 삭제한다.
7. 처리된 요청 ID와 건수를 JSON result로 반환한다.

반려 RPC도 같은 권한·입력 검증과 결정적 row lock을 적용한다. 대상 row 수가 입력
수와 다르면 conflict로 실패하고, 모두 존재할 때만 한 statement로 삭제한다.

Database Function 호출 하나가 PostgreSQL transaction 하나이므로 unique constraint,
trigger 또는 delete 과정에서 예외가 발생하면 같은 호출의 모든 변경이 rollback된다.
승인과 반려가 같은 요청을 동시에 처리하면 row lock을 먼저 획득한 호출만 성공하고,
뒤의 호출은 잠금 해제 후 대상 row 부재를 확인해 conflict로 실패한다.

이 작업은 최대 30개의 작은 관리자 command이므로 operation/batch 상태 table과
IndexedDB 재개 payload를 추가하지 않는다. 실패한 command는 DB 변경이 없으므로 현재
선택을 그대로 두고 사용자가 재시도한다.

## 오류 계약

DB는 사용자에게 노출해도 되는 다음 공개 code만 exception message로 반환한다.

- `DOCS_REQUEST_MODERATION_UNAUTHORIZED`
- `DOCS_REQUEST_MODERATION_FORBIDDEN`
- `DOCS_REQUEST_MODERATION_INVALID_INPUT`
- `DOCS_REQUEST_MODERATION_CONFLICT`
- `DOCS_REQUEST_MODERATION_INTERNAL_ERROR`

Supabase adapter는 공통 오류 mapper를 먼저 사용하고, 위 code를 각각
`unauthorized`, `forbidden`, `validation`, `conflict`, `infrastructure` 종류의
`ApplicationError`로 변환한다. 알 수 없는 DB 오류, network 예외, 성공 응답 shape 오류는
안전한 infrastructure 오류로 변환한다. SQL 원문, stack, 내부 relation 이름은 UI Modal에
표시하지 않는다.

## Presentation 동작

`RequestDocsHome`은 선택된 요청을 Application command로 변환한다. 승인 시 화면의
두음 설정이 없으면 현재 요청의 `initial_consonant` 값을 사용한다. 현재 wrapper가 모든
요청을 `false`로 초기화하므로 기존 기본 동작은 유지된다.

승인·반려 mutation이 진행 중이면 두 버튼을 모두 비활성화한다. 성공하면 RPC가 반환한
`processedRequestIds`만 목록, 선택 set, 두음 설정에서 제거하고 현재 페이지를 1로
설정한다. 실패하면 목록, 선택, 두음 설정, 페이지를 변경하지 않고 프로젝트 Modal에
안전한 오류를 표시한다.

빈 선택은 기존처럼 DB를 호출하지 않는다. 30개 초과는 Domain validation 오류로
처리하며 DB도 동일한 제한을 검증한다.

`RequestDocsWrapper`의 조회, loading, 조회 오류 화면은 변경하지 않는다.

## 테스트 전략

### Characterization 및 component test

- 승인 command에 선택된 요청 ID와 두음 설정이 전달된다.
- 성공 결과의 요청만 목록에서 제거된다.
- 실패 시 목록과 선택이 유지되고 Modal이 표시된다.
- 반려 command가 선택된 요청 ID를 전달한다.
- pending 중 승인·반려 버튼이 비활성화된다.
- `RequestDocsHome`이 `SCM`과 Supabase SDK를 import하지 않는다.

### Domain unit test

- 승인·반려 입력을 요청 ID 순으로 정렬한다.
- 빈 입력, 30개 초과, 잘못된 ID, 중복 ID를 거부한다.
- 승인 `duem`의 잘못된 타입을 거부한다.

### Application unit test

- 정규화된 command만 gateway에 전달한다.
- validation 실패 시 gateway를 호출하지 않는다.
- gateway가 반환한 성공과 오류를 그대로 보존한다.

### Infrastructure adapter 및 hook test

- 승인·반려가 정확한 RPC 이름과 payload를 전달한다.
- 성공 result shape를 검증하고 요청 ID를 정렬한다.
- 공개 DB 오류를 안정적인 `ApplicationError`로 변환한다.
- 잘못된 성공 응답과 thrown exception을 infrastructure 오류로 변환한다.
- hook이 pending, error, clearError와 예외 안전 동작을 제공한다.

### Local database integration test

- 관리자 승인 시 docs 생성과 docs_wait 삭제가 함께 반영된다.
- 관리자 반려 시 선택된 docs_wait row만 삭제된다.
- 비인증 사용자와 일반 사용자는 거부된다.
- 없는 요청이 섞이면 전체 command가 rollback된다.
- docs 이름 unique 충돌 시 docs_wait 삭제 없이 전체 승인 command가 rollback된다.
- 30개 초과와 중복 ID가 변경 없이 거부된다.
- 같은 요청에 대한 동시 승인·반려에서 한 호출만 성공하며 side effect가 중복되지 않는다.

## 검증

관련 Jest 테스트와 함께 다음 명령을 실행한다.

```bash
npm run lint
npx tsc --noEmit
```

DB migration과 RPC는 로컬 Supabase에서만 검증한다. 기본 수명주기는
`supabase start` → migration/RPC integration test → `supabase stop`이며 성공·실패와
관계없이 작업 종료 시 로컬 stack을 중지한다. 원격 project를 대상으로 하는 `--linked`,
`db push` 명령은 실행하지 않는다.

## 완료 기준

- docs 생성과 요청 삭제가 하나의 승인 RPC transaction으로 처리된다.
- 반려가 전용 RPC command로 처리된다.
- 승인·반려에서 최대 30개 제한과 관리자 권한이 DB에서도 검증된다.
- `RequestDocsHome`에서 `SCM`, Supabase SDK, `.rpc()`, `.from()` 사용이 0건이다.
- `SCM.add().docs`와 `SCM.delete().waitDocsByIds`의 계약과 구현이 제거된다.
- 조회 경로는 의도대로 legacy SCM에 남아 있다.
- 관련 unit, component, adapter, hook, local DB integration test가 통과한다.
- lint와 TypeScript type check가 통과한다.
- migration은 저장소에 기록되고 원격 Supabase에는 자동 적용되지 않는다.

## 결정 사항

- 전용 `docs` module을 만들고 기존 `word-moderation` module을 확장하지 않는다.
- 승인과 반려에 각각 명시적인 Database RPC를 사용한다.
- 하나의 command는 all-or-nothing이며 부분 성공을 허용하지 않는다.
- 최대 command 크기는 30개다.
- 작은 관리자 command이므로 durable operation과 재개 모델은 사용하지 않는다.
- 요청 목록 조회는 이번 범위에서 이전하지 않는다.
