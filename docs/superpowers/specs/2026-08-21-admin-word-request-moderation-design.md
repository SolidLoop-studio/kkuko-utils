# 관리자 요청 단어 moderation mutation 설계

> 상태: 설계 승인 및 구현 계획 작성
>
> 작성일: 2026-08-21
>
> 관련 로드맵: `docs/architecture/ddd-lite-migration-roadmap.md` Phase 1

## 1. 목표

`admin/request-words` 화면의 승인과 반려 mutation을 UI의 순차적인 `SCM` 호출에서 분리한다. 버튼 한 번으로 선택한 요청의 단어, 주제 관계, 로그, docs, 기여도, 대기열 변경을 각각 하나의 Database RPC transaction에서 처리한다.

이번 세로 슬라이스는 현재 사용자 선택 규칙을 유지하면서 다음 경계를 만든다.

- Domain은 moderation 선택을 검증하고 정규화한다.
- Application은 승인과 반려 use case를 명시적으로 제공한다.
- Infrastructure만 Supabase RPC와 DB 응답을 안다.
- Presentation은 command 제출, 진행 상태, 안전한 오류 표시, 성공 후 새로고침만 담당한다.

## 2. 범위

### 포함

- `AdminRequestHome.tsx`의 선택 승인 mutation
- `AdminRequestHome.tsx`의 선택 반려 mutation
- 승인과 반려 전용 Application service 및 port
- 브라우저 Supabase RPC gateway
- 승인과 반려를 위한 forward migration
- Domain, Application, adapter, presentation, 실제 DB 통합 테스트
- 대체된 `SCM` mutation 호출 및 manager 메서드 제거
- 빈 선택 알림을 프로젝트 Modal로 교체

### 제외

- `AdminWrapper.tsx`의 대기 요청 조회 이전
- `AdminRequestHome.tsx`의 전체 주제 조회 이전
- `ThemeSelectModal.tsx`의 조회 이전
- `words-docs/[id]/TableWorkFunc.tsx` 이전
- 하드코딩된 docs 숫자 PK 제거와 Phase 0B
- 재개 가능한 operation/batch 모델
- 원격 Supabase 배포

조회 경로의 `SCM`은 후속 read-side 작업까지 유지한다. 이번 작업은 mutation 경계만 완결한다.

## 3. 현재 동작과 위험

현재 승인은 컴포넌트에서 다음 작업을 순차 실행한다.

1. 삭제 전 단어 주제를 조회한다.
2. 단어를 추가한다.
3. 기존 단어의 주제를 추가하거나 삭제한다.
4. 단어를 삭제한다.
5. 새 단어의 주제를 연결한다.
6. docs 정보를 조회하고 로그 payload를 조립한다.
7. docs 로그와 단어 로그를 삽입한다.
8. 단어 및 주제 변경 대기열을 삭제한다.
9. docs 최근 수정일과 사용자 기여도를 갱신한다.

현재 반려는 단어 로그 삽입과 두 종류의 대기열 삭제를 독립 호출로 수행한다. 어느 중간 호출이 실패해도 앞선 변경이 남을 수 있으며, 브라우저 재시도나 동시 관리자 처리 시 결과가 명확하지 않다.

## 4. 핵심 결정

### 4.1 승인과 반려 RPC 분리

다음 두 업무 명령을 별도 RPC로 제공한다.

- `approve_word_requests`
- `reject_word_requests`

승인과 반려는 side effect와 검증 규칙이 다르므로 하나의 action 인자를 받는 범용 RPC로 합치지 않는다. 공통 관리자 검증이나 입력 파싱은 private SQL helper로 공유할 수 있다.

### 4.2 한 화면 선택을 하나의 transaction으로 처리

현재 한 페이지에서 선택할 수 있는 요청은 최대 30개다. 한 번의 클릭으로 제출된 선택 전체를 하나의 transaction으로 처리한다. 일부만 성공하는 결과는 허용하지 않는다.

긴 작업을 위한 operation table, IndexedDB payload, 재개 및 취소 기능은 추가하지 않는다. 이 기능의 입력 크기와 실행 시간에는 필요하지 않다.

### 4.3 클라이언트 데이터를 업무 사실로 신뢰하지 않음

클라이언트는 안정적인 식별자와 선택 정보만 전송한다. 다음 값은 DB가 잠근 대기 요청에서 다시 구한다.

- 단어 문자열과 단어 ID
- 요청 종류
- 요청자 UUID
- 주제 코드와 이름
- 현재 단어-주제 관계

처리 관리자는 `auth.uid()`와 `users.role`로 RPC 안에서 검증한다. 클라이언트가 보낸 사용자 ID를 감사 actor로 사용하지 않는다.

## 5. Domain 및 Application 계약

### 5.1 선택 입력

```ts
export type WordRequestModerationSelection =
    | {
        kind: 'word-request';
        requestId: number;
        selectedThemeIds: number[];
    }
    | {
        kind: 'theme-change';
        wordId: number;
        changes: Array<{
            themeId: number;
            type: 'add' | 'delete';
        }>;
    };

export type ModerateWordRequestsCommand = {
    selections: WordRequestModerationSelection[];
};
```

`word-request`의 실제 요청 종류는 DB가 판단한다. 추가 요청에는 선택한 주제가 하나 이상 필요하고, 삭제 요청의 `selectedThemeIds`는 비어 있어야 한다. `theme-change`는 화면이 선택한 대기 변경만 전달한다.

### 5.2 Domain 검증

Domain은 DB 없이 다음을 검증한다.

- 선택이 비어 있지 않다.
- 최상위 선택은 30개 이하이다.
- 모든 ID는 양의 안전한 정수다.
- 같은 `requestId`가 중복되지 않는다.
- 같은 `(wordId, themeId, type)` 변경이 중복되지 않는다.
- 한 command에서 같은 단어에 상충하는 주제 변경을 보내지 않는다.
- 각 `theme-change` 항목에는 하나 이상의 변경이 있다.

추가 요청 여부처럼 DB 조회가 필요한 규칙은 RPC가 권위 있게 검증한다.

### 5.3 Application service와 port

Application은 다음 두 use case를 제공한다.

```ts
approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>
reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>>
```

결과는 UI가 완료 상태를 표시하고 새로고침 여부를 결정하는 최소 정보만 포함한다.

```ts
export type WordRequestModerationResult = {
    processedWordRequestCount: number;
    processedThemeChangeCount: number;
    affectedDocsIds: number[];
};
```

반려 결과의 `affectedDocsIds`는 빈 배열이다.

## 6. 승인 업무 규칙

### 6.1 공통 선행 조건

RPC는 side effect 전에 모든 선택을 검증한다.

1. 인증된 관리자인지 검증한다.
2. JSON 구조와 최대 선택 개수를 검증한다.
3. 요청 ID와 주제 변경 key를 결정적인 순서로 잠근다.
4. 모든 요청이 존재하고 아직 대기 상태인지 확인한다.
5. 클라이언트의 선택 주제가 실제 대기 요청에 속하는지 확인한다.
6. 상충하거나 중복된 선택이 없는지 확인한다.

검증 중 하나라도 실패하면 아무 side effect도 수행하지 않는다.

### 6.2 단어 추가 요청 승인

- 선택 주제가 하나 이상이어야 한다.
- 요청의 단어와 요청자를 대기 요청에서 조회한다.
- 선택 주제의 실제 코드를 조회해 `noin_canuse`를 계산한다.
- 단어를 추가하고 요청자를 `added_by`로 기록한다.
- 선택 주제만 새 단어에 연결한다.
- 단어 승인 로그를 생성한다.
- 마지막 글자 docs와 연결된 주제 docs에 추가 로그를 생성한다.
- 영향을 받은 docs의 최근 수정일을 갱신한다.
- 요청자의 기여도를 1 증가시킨다.
- 단어 추가 대기 요청과 그 요청에 연결된 주제 대기열 전체를 제거한다.

마지막 규칙은 현재 동작을 유지한다. 승인 시 선택하지 않은 추가 주제도 별도 대기 상태로 남기지 않는다.

### 6.3 단어 삭제 요청 승인

- 삭제 전 단어 문자열과 연결 주제를 확보한다.
- 단어를 삭제한다.
- 단어 승인 로그를 생성한다.
- 마지막 글자 docs와 기존 주제 docs에 삭제 로그를 생성한다.
- 영향을 받은 docs의 최근 수정일을 갱신한다.
- 요청자의 기여도를 1 증가시킨다.
- 해당 삭제 대기 요청을 제거한다.

### 6.4 주제 변경 요청 승인

- 선택한 `(wordId, themeId, type)`이 실제 대기 변경과 정확히 일치해야 한다.
- `add`는 단어-주제 관계를 추가하고 `delete`는 관계를 삭제한다.
- 실제로 반영한 주제 docs에 추가 또는 삭제 로그를 생성한다.
- 영향을 받은 docs의 최근 수정일을 갱신한다.
- 처리한 주제 변경 대기 행만 제거한다.
- 선택하지 않은 주제 변경 대기 행은 유지한다.
- 단어 로그를 만들거나 사용자 기여도를 변경하지 않는다.

## 7. 반려 업무 규칙

### 7.1 단어 추가 및 삭제 요청 반려

- 요청의 단어, 종류, 요청자를 DB에서 조회한다.
- 처리 관리자는 `auth.uid()`를 사용한다.
- `rejected` 단어 로그를 생성한다.
- 해당 대기 요청을 제거한다.
- 단어, 단어-주제 관계, docs 및 기여도는 변경하지 않는다.

### 7.2 주제 변경 요청 반려

- 선택한 주제 변경이 실제 대기 행과 일치하는지 검증한다.
- 선택한 대기 행만 제거한다.
- 선택하지 않은 변경은 유지한다.
- 단어 로그, docs 로그 및 기여도는 만들지 않는다.

## 8. Transaction과 동시성

- 한 RPC 호출의 모든 선택은 하나의 PostgreSQL transaction이다.
- `wait_words`는 request ID 오름차순으로 잠근다.
- 주제 변경 대기 행은 `(word_id, theme_id, type)`의 결정적 순서로 잠근다.
- 잠금 뒤 현재 상태를 다시 검증한다.
- 두 관리자가 같은 요청을 처리하면 먼저 잠금을 얻은 transaction만 성공한다.
- 나중 transaction은 요청이 사라졌거나 변경된 것을 확인하고 conflict로 종료한다.
- conflict transaction에는 로그, 기여도 등 어떤 side effect도 남지 않는다.
- 응답 유실 후 수동 재시도는 이미 처리된 요청에 대한 conflict가 될 수 있다. UI는 목록을 다시 불러와 DB 상태를 표시한다.

별도 idempotency operation table은 만들지 않는다. 대기 요청 잠금과 transaction 삭제가 중복 side effect를 막는 경계다.

## 9. 오류 계약

RPC는 다음 공개 오류 코드만 클라이언트에 제공한다.

- `WORD_REQUEST_MODERATION_UNAUTHORIZED`
- `WORD_REQUEST_MODERATION_FORBIDDEN`
- `WORD_REQUEST_MODERATION_INVALID_INPUT`
- `WORD_REQUEST_MODERATION_CONFLICT`
- `WORD_REQUEST_MODERATION_INTERNAL_ERROR`

Infrastructure adapter는 공개 코드를 각각 안정적인 `ApplicationError.kind`로 변환한다. 예상하지 못한 SQLSTATE, constraint 또는 trigger 오류 원문은 UI에 노출하지 않고 internal error로 변환한다.

UI는 다음 원칙을 따른다.

- validation 오류는 사용자가 선택을 수정할 수 있는 메시지로 표시한다.
- conflict는 목록이 변경되었음을 알리고 새로고침을 유도한다.
- 권한 오류와 internal 오류는 안전한 공통 메시지를 Modal에 표시한다.
- 실패 시 선택 상태를 유지한다.
- 성공 시에만 선택 상태를 초기화하고 `refreshFn()`을 실행한다.
- mutation 실행 중 승인과 반려 버튼을 비활성화해 같은 화면의 중복 제출을 막는다.

## 10. Presentation 데이터 흐름

```text
사용자 선택
  -> AdminRequestHome이 식별자 기반 selection 생성
  -> useWordRequestModeration
  -> Application service의 approve 또는 reject
  -> Supabase RPC gateway
  -> Database RPC transaction
  -> Result<WordRequestModerationResult>
  -> 성공: 선택 초기화 + refreshFn
  -> 실패: 선택 유지 + Modal
```

컴포넌트는 table, column, RPC 이름이나 DB 호출 순서를 알지 않는다. 읽기용 `SCM`은 이번 범위에서 유지하지만 mutation용 `SCM` 호출은 남기지 않는다.

## 11. 구현 파일 구조

### 새 파일

- `src/modules/word-moderation/domain/word-request-moderation.ts`
- `src/modules/word-moderation/application/word-request-moderation-types.ts`
- `src/modules/word-moderation/application/moderate-word-requests.ts`
- `src/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.ts`
- `src/modules/word-moderation/presentation/use-word-request-moderation.ts`
- `src/__tests__/modules/word-moderation/domain/word-request-moderation.test.ts`
- `src/__tests__/modules/word-moderation/application/moderate-word-requests.test.ts`
- `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts`
- `src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx`
- `src/__tests__/admin/request-words/AdminRequestHome.test.tsx`
- `supabase/tests/database/word-request-moderation.integration.sql`
- `supabase/migrations/<timestamp>_admin_word_request_moderation.sql`

### 수정 파일

- `src/app/admin/request-words/AdminRequestHome.tsx`
- `src/modules/word-moderation/application/ports.ts` 또는 동일 책임의 전용 port 파일
- `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- `src/modules/word-moderation/index.ts`
- 대체된 메서드를 가진 legacy SCM 구현과 interface
- 관련 DB 테스트 실행 문서 또는 스크립트
- `docs/architecture/ddd-lite-migration-roadmap.md`

정확한 migration timestamp와 legacy SCM 메서드 목록은 구현 계획에서 고정한다. 자동 생성 파일인 `src/app/types/database.types.ts`는 직접 수정하지 않는다.

## 12. 테스트 전략

### 12.1 Characterization 및 presentation

- 추가 요청에서 선택한 주제만 command에 포함한다.
- 추가 요청 승인이 완료되면 전체 요청이 목록에서 제거되는 현재 규칙을 유지한다.
- 주제 변경은 선택한 변경만 승인 또는 반려한다.
- 선택하지 않은 주제 변경은 남는다.
- 단어 추가·삭제 반려는 단어 로그 대상이 된다.
- 주제 변경 반려는 단어 로그 대상이 아니다.
- 실행 중 중복 클릭을 차단한다.
- 성공한 경우에만 선택 상태를 비우고 새로고침한다.
- 실패 시 선택을 유지하고 Modal을 표시한다.

### 12.2 Domain 단위 테스트

- 빈 선택 거부
- 30개 초과 선택 거부
- 유효하지 않은 ID 거부
- 중복 request ID 거부
- 중복 및 상충하는 주제 변경 거부
- 결정적인 정규화 순서

### 12.3 Application 단위 테스트

- 승인과 반려 gateway에 정규화된 command 전달
- Domain validation 실패 시 gateway 미호출
- 성공 결과 반환
- conflict, forbidden 및 infrastructure 오류 보존

### 12.4 Infrastructure adapter 테스트

- 정확한 RPC 이름과 JSON payload
- 정상 응답 mapper
- malformed 응답을 infrastructure 오류로 변환
- 공개 RPC 오류 코드를 `ApplicationError`로 변환
- 예상하지 못한 DB 오류 원문을 UI 계약 밖으로 차단

### 12.5 실제 DB 통합 테스트

- 익명 및 일반 사용자 거부, 관리자 허용
- 추가·삭제·주제 변경 혼합 승인
- 추가·삭제·주제 변경 혼합 반려
- 단어, 주제 관계, 단어 로그, docs 로그, docs 최근 수정일, 기여도, 대기열 결과
- 선택하지 않은 주제 변경 유지
- 존재하지 않거나 이미 처리된 요청 conflict
- client selection과 실제 대기 주제 불일치 conflict
- 로그 또는 기여도 단계에서 강제 실패했을 때 전체 rollback
- 동시 처리에서 한 transaction만 side effect 생성
- `anon` 실행 권한 부재와 `authenticated` 실행 권한 존재

## 13. 마이그레이션 및 배포

- DB 변경은 새 forward migration으로만 추가한다.
- 기존 remote migration을 수정하지 않는다.
- 기존 프로덕션 숫자 docs ID 전제는 이번 작업에서 변경하지 않는다.
- local Supabase에서 migration과 실제 RPC 테스트를 먼저 검증한다.
- 원격 프로젝트 적용은 별도 운영 단계로 남긴다.
- 생성 DB 타입 갱신이 필요하면 Supabase schema 적용 후 `npm run gen-type`을 사용하며 파일을 수동 편집하지 않는다.

## 14. 검증

구현 완료 후 다음을 실행한다.

```bash
npm run lint
npx tsc --noEmit
npx jest src/__tests__/modules/word-moderation src/__tests__/admin/request-words --runInBand
```

DB 작업은 local Supabase를 시작한 뒤 migration과 `word-request-moderation.integration.sql`을 실행하고, 성공 또는 실패와 무관하게 작업 종료 시 local stack을 중지한다.

## 15. 완료 조건

- 승인과 반려에서 직접 `SCM` mutation 호출이 0개다.
- 컴포넌트가 DB table, column, RPC 이름을 모른다.
- 승인 선택 전체 또는 반려 선택 전체가 하나의 transaction이다.
- 관리 권한과 요청의 현재 상태를 DB가 재검증한다.
- 부분 실패 시 모든 side effect가 rollback된다.
- 동시 처리 시 중복 로그와 기여도가 발생하지 않는다.
- 성공과 실패의 UI 선택 상태 규칙이 테스트로 고정된다.
- 관련 Domain, Application, adapter, presentation 및 DB 테스트가 통과한다.
- lint와 TypeScript type check가 통과한다.
- 대체된 legacy SCM mutation 메서드가 제거된다.
- 로드맵 진행 상태가 갱신된다.
