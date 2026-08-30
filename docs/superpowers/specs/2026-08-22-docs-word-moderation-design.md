# Docs 단어 moderation 및 관리자 즉시 삭제 설계

> 작성일: 2026-08-22
>
> 대상: `words-docs/[id]`의 관리자 단어 요청 승인·반려와 관리자 즉시 삭제

## 1. 목적

`src/app/words-docs/[id]/TableWorkFunc.tsx`는 단어 요청 승인·반려, 관리자 즉시 삭제, 사용자 요청 생성·취소를 한 hook에서 직접 `SCM` 호출 순서로 조정한다. 관리자 mutation은 단어, 주제 관계, 대기 요청, 단어 로그, docs 로그, docs 최근 수정일, 사용자 기여도를 여러 독립 요청으로 변경하므로 중간 실패 시 부분 성공이 남을 수 있다.

이번 세로 슬라이스는 관리자에게 노출되는 다음 다섯 동작만 DDD-lite 경계로 이전한다.

- 단어 추가 요청 승인
- 단어 추가 요청 반려
- 단어 삭제 요청 승인
- 단어 삭제 요청 반려
- 등록 단어 관리자 즉시 삭제

기존 `approve_word_requests`와 `reject_word_requests` RPC를 재사용하고, 즉시 삭제만 별도의 원자적 RPC로 추가한다. UI는 식별자 기반 command와 `Result`만 다루며 Supabase table, column, RPC 이름을 알지 않는다.

## 2. 범위

### 포함

- docs 목록의 관리자 mutation 대상 식별자 조회
- 전체 단어 요청과 주제 변경 요청의 구분
- 기존 word request moderation Application service와 RPC 재사용
- 관리자 즉시 삭제 Domain/Application 계약과 Database RPC
- 관리자 mutation 전용 presentation hook
- 성공 후 목록 행의 로컬 상태 갱신
- 안전한 오류 Modal과 중복 제출 방지
- 대체된 `TableWorkFunc.tsx` 관리자 `SCM` mutation 제거
- characterization, Domain, Application, adapter, presentation, 실제 DB 테스트
- DDD-lite 로드맵 진행 상태 갱신

### 제외

- 사용자 요청 생성 `RequestDelete`
- 사용자 요청 취소 `CancelAddRequest`, `CancelDeleteRequest`
- `DocsDataPage.tsx`의 전체 조회 경계 이전
- docs 즐겨찾기, 조회 수, docs 로그 조회 이전
- `admin/request-docs` 이전
- 하드코딩된 docs 숫자 ID 제거와 Phase 0B
- 기존 `approve_word_requests`와 `reject_word_requests`의 공개 권한 변경
- 원격 Supabase 배포

사용자 mutation 세 개는 Phase 2까지 legacy 경로를 유지하되 관리자 코드와 별도 hook으로 분리한다.

## 3. 현재 동작과 발견된 결함

### 3.1 관리자 요청 처리

현재 전체 단어 요청 승인은 브라우저에서 다음 변경을 순서대로 수행한다.

1. 단어 요청과 대기 주제를 조회한다.
2. 단어 또는 단어-주제 관계를 변경한다.
3. 단어 로그와 docs 로그를 기록한다.
4. docs 최근 수정일과 요청자 기여도를 갱신한다.
5. 대기 요청을 삭제한다.

반려도 대기 요청 삭제와 단어 로그 기록이 독립 요청이다. 어느 단계든 실패하면 앞선 변경이 남으며, 재시도 시 중복 로그나 기여도가 발생할 수 있다.

### 3.2 중복 주제 docs 로그

삭제 요청 승인과 관리자 즉시 삭제는 같은 `okThemeDocs` payload를 두 번 삽입한다. 이번 이전에서는 이를 의도된 동작으로 보존하지 않는다. 새 transaction은 각 직접 영향 docs에 논리적 변경당 로그 한 건만 기록한다.

### 3.3 주제 변경 요청의 무동작

주제 docs 목록은 `word_themes_wait`의 추가·삭제 요청도 표시한다. 그러나 현재 관리자 handler는 `wait_words`만 조회하므로 해당 버튼이 조용히 종료된다. 새 구조는 목록 항목의 source를 식별하고 기존 moderation RPC의 `theme-change` selection으로 연결한다.

### 3.4 권한과 중복 제출

관리자 버튼은 현재 `admin`에게만 표시된다. 이 UI 권한은 유지한다. 기존 request moderation RPC의 `r4` 허용 정책은 이번 범위에서 변경하지 않지만 docs 화면은 `r4`에게 관리자 버튼을 노출하지 않는다.

현재 `beforeCheck` 조건은 권한과 pending 조건을 잘못 결합해 관리자 중복 제출을 안정적으로 막지 못한다. 새 hook은 React Query mutation의 `isPending`을 사용한다.

## 4. 핵심 결정

### 4.1 기존 request moderation 재사용

전체 단어 요청과 주제 변경 요청은 이미 검증된 다음 RPC를 사용한다.

- `approve_word_requests`
- `reject_word_requests`

docs 전용 승인·반려 RPC를 새로 만들지 않는다. transaction, row lock, 관리자 재검증, 로그·기여도 규칙, conflict 처리를 두 번째 구현으로 복제하지 않는다.

### 4.2 즉시 삭제는 작은 전용 명령

관리자 즉시 삭제는 대기 요청 moderation과 수명주기가 다르므로 `delete_word_directly` RPC로 분리한다. 단어 하나를 삭제하기 위해 재개 가능한 대량 삭제 operation row와 IndexedDB job을 만들지 않는다.

### 4.3 문자열이 아닌 안정적인 식별자 사용

UI action은 단어 문자열로 대기 요청을 다시 찾지 않는다. docs 목록을 구성할 때 feature query가 현재 행에 대응하는 mutation target을 조회해 다음 식별자를 붙인다.

```ts
export type DocsWordMutationTarget =
    | {
        kind: 'word-request';
        requestId: number;
        requestType: 'add' | 'delete';
        selectedThemeIds: number[];
    }
    | {
        kind: 'theme-change';
        wordId: number;
        themeId: number;
        type: 'add' | 'delete';
    }
    | {
        kind: 'registered-word';
        wordId: number;
    };
```

feature query는 legacy `docsWords` 결과와 `docsId`를 입력받고 RLS로 보호된 browser Supabase adapter에서 다음 정보를 조회한다.

- `wait_words.id`, 요청 종류, 연결된 모든 `wait_word_themes.theme_id`
- 현재 theme docs에 대응하는 `word_themes_wait`의 `word_id`, `theme_id`, `typez`
- 등록 단어의 `words.id`

전체 단어 요청이 존재하면 해당 request target을 사용한다. 그렇지 않은 pending theme row는 현재 docs의 theme-change target으로 매핑한다. 등록 상태 행은 registered-word target으로 매핑한다. 조회 중 대상이 사라지거나 모호하면 해당 행의 관리자 버튼을 비활성화하고 안전한 conflict 상태로 취급한다.

이 조회는 기존 SCM에 신규 메서드를 추가하지 않고 `word-moderation` Infrastructure adapter에 둔다. `DocsDataPage`의 나머지 조회는 Phase 4까지 유지한다.

## 5. Application 계약

### 5.1 docs mutation target query

Application query는 DB Row를 노출하지 않고 행별 `DocsWordMutationTarget`을 반환한다.

```ts
type GetDocsWordMutationTargetsQuery = {
    docsId: number;
    rows: Array<{
        word: string;
        status: 'add' | 'delete' | 'ok';
    }>;
};
```

입력 ID와 행 상태를 검증하고 결과 순서를 입력 행과 독립적인 key 형태로 반환한다. Supabase join과 nullable 응답 해석은 Infrastructure가 담당한다.

### 5.2 요청 승인·반려 mapping

presentation hook은 target을 기존 `ModerateWordRequestsCommand`로 변환한다.

- `word-request`
  - `requestId`와 `selectedThemeIds`를 그대로 사용한다.
  - 추가 승인에는 대기 요청에 연결된 모든 주제 ID를 전달한다.
  - 삭제 승인에는 빈 주제 ID 목록을 전달한다.
  - 반려 command도 기존 계약에 맞춰 target의 안정적인 식별자를 사용한다.
- `theme-change`
  - `wordId`와 현재 docs의 단일 `{ themeId, type }` 변경을 전달한다.
  - 같은 단어의 다른 대기 주제 변경은 처리하지 않는다.

### 5.3 관리자 즉시 삭제

```ts
export type DeleteWordDirectlyCommand = {
    wordId: number;
};

export type DeleteWordDirectlyResult = {
    deletedWordCount: 1;
    affectedDocsIds: number[];
};
```

Domain은 `wordId`가 안전한 양의 정수인지 검증한다. Application service는 검증된 command를 작은 gateway port에 전달하고 `Result<DeleteWordDirectlyResult>`를 반환한다.

## 6. Database RPC 설계

새 forward migration은 다음 함수를 추가한다.

```sql
public.delete_word_directly(p_word_id bigint) returns jsonb
```

함수는 `security definer`와 고정된 `search_path`를 사용하며 다음 순서로 실행한다.

1. `auth.uid()`가 존재하는지 확인한다.
2. `users.role = 'admin'`인지 DB에서 재검증한다.
3. 입력 `wordId`와 현재 단어 행을 검증하고 잠근다.
4. 단어-주제 관계, 관련 대기 요청, 영향받는 docs와 사용자 행을 결정적인 순서로 잠근다.
5. 삭제 전 단어, 주제, 작성자를 snapshot한다.
6. 단어 로그를 `make_by = actor`, `processed_by = actor`, `r_type = delete`, `state = approved`로 한 건 기록한다.
7. 마지막 글자 docs와 연결 주제 docs에 각각 한 건의 삭제 로그를 기록한다.
8. 영향받은 docs 최근 수정일과 관리자 기여도를 갱신한다.
9. 단어를 삭제한다. FK cascade가 해당 단어의 `wait_words`, `word_themes_wait`, `word_themes`를 정리한다.
10. authoritative result를 반환한다.

현재 즉시 삭제는 대량 삭제의 숫자 주제 보호 정책을 적용하지 않으므로 이 동작을 유지한다. word trigger가 소유하는 특수 docs 로그는 trigger에 맡기며 RPC가 동일한 특수 로그를 다시 만들지 않는다.

두 관리자가 같은 단어를 동시에 삭제하면 먼저 잠금을 얻은 transaction만 성공한다. 나중 transaction은 conflict이며 어떤 추가 side effect도 남기지 않는다.

## 7. 오류 계약

즉시 삭제 RPC는 다음 공개 code만 노출한다.

- `DIRECT_WORD_DELETION_UNAUTHORIZED`
- `DIRECT_WORD_DELETION_FORBIDDEN`
- `DIRECT_WORD_DELETION_INVALID_INPUT`
- `DIRECT_WORD_DELETION_CONFLICT`
- `DIRECT_WORD_DELETION_INTERNAL_ERROR`

Infrastructure adapter는 이를 `ApplicationError.kind`로 변환한다. 예상하지 못한 SQLSTATE, constraint, trigger 오류 원문은 UI에 전달하지 않는다.

docs mutation target 조회 실패도 안정적인 validation, conflict 또는 infrastructure 오류로 변환한다. UI는 다음 원칙을 따른다.

- conflict: 다른 관리자 처리 또는 목록 변경을 안내한다.
- validation: 대상 정보를 다시 확인하도록 안내한다.
- unauthorized/forbidden: 권한 오류를 안전한 메시지로 표시한다.
- infrastructure: 내부 상세 없이 공통 실패 메시지를 표시한다.
- 실패 시 작업 모달과 행 상태를 유지한다.

## 8. Presentation 흐름

`TableWorkFunc.tsx`의 책임을 다음과 같이 분리한다.

- `useDocsWordModeration`
  - 기존 request moderation service와 새 direct deletion service 조합
  - target을 승인·반려 command로 변환
  - mutation pending과 안전한 `ApplicationError` 제공
- 사용자 요청 action hook
  - `RequestDelete`, `CancelAddRequest`, `CancelDeleteRequest`만 유지
  - Phase 2 전까지 기존 SCM 동작 보존

관리자 UI 데이터 흐름은 다음과 같다.

```text
legacy docs 조회
  -> feature target query로 안정적인 식별자 보강
  -> Table / WorkModal
  -> useDocsWordModeration
  -> 기존 request moderation RPC 또는 direct deletion RPC
  -> Result
  -> 성공: 행 상태 갱신 + 작업 모달 닫기 + 완료 모달
  -> 실패: 행/작업 모달 유지 + 안전한 오류 Modal
```

행 상태는 mutation 성공 후 다음과 같이 로컬에서 갱신한다.

| 동작 | 결과 |
| --- | --- |
| 추가 승인 | `ok`로 전환 |
| 추가 반려 | 행 제거 |
| 삭제 승인 | 행 제거 |
| 삭제 반려 | `ok`로 전환 |
| 관리자 즉시 삭제 | 행 제거 |

주제 변경 요청도 표시 상태의 `add` 또는 `delete`에 따라 같은 규칙을 적용한다. 성공 전에는 행을 변경하지 않는다.

관리자 버튼은 `user.role === 'admin'`일 때만 표시한다. 관리자 mutation `isPending`과 legacy 사용자 mutation `isProcessing`을 합쳐 spinner와 모든 action 버튼을 비활성화한다.

## 9. 테스트 전략

### 9.1 Characterization 및 presentation

- `admin`만 관리자 버튼을 볼 수 있고 `r4`와 일반 사용자는 볼 수 없다.
- 전체 추가 요청 승인은 요청의 모든 대기 주제를 command에 포함한다.
- 전체 삭제 요청 승인은 빈 주제 목록을 사용한다.
- 주제 변경 요청은 현재 docs의 변경 한 건만 승인 또는 반려한다.
- 추가 승인과 삭제 반려 성공은 행을 `ok`로 전환한다.
- 추가 반려, 삭제 승인, 즉시 삭제 성공은 행을 제거한다.
- 실패 시 행과 작업 모달을 유지하고 안전한 오류 Modal을 표시한다.
- pending 동안 재클릭과 다른 관리자 action을 막는다.
- 사용자 요청 생성·취소 버튼과 callback 동작은 유지된다.

명시적으로 수정하기로 한 중복 주제 로그와 주제 변경 무동작은 보존 대상 characterization에서 제외하고 회귀 테스트로 올바른 새 동작을 고정한다.

### 9.2 Domain 및 Application

- 유효하지 않은 `wordId` 거부
- 검증 실패 시 direct deletion gateway 미호출
- 검증된 command 전달과 성공 결과 반환
- conflict, forbidden, infrastructure 오류 보존
- docs target을 기존 moderation selection으로 정확히 변환

### 9.3 Infrastructure adapter

- 정확한 RPC 이름과 `{ p_word_id }` payload
- 정상 result mapper
- malformed response를 infrastructure 오류로 변환
- 공개 DB 오류 code를 안정적인 `ApplicationError`로 변환
- 예상하지 못한 DB 오류 원문 차단
- docs target query의 word-request/theme-change/registered-word mapper

### 9.4 실제 DB 통합 테스트

- 익명·일반 사용자·`r4`의 직접 삭제 거부와 `admin` 허용
- 단어, 주제 관계, 연결된 대기 요청의 원자적 삭제
- 단어 로그 1건과 각 직접 영향 docs 로그 1건
- 주제 docs 로그가 중복되지 않음
- docs 최근 수정일과 관리자 기여도 증가
- trigger 소유 특수 docs side effect 유지
- 강제 실패 시 전체 rollback
- 동시 삭제에서 한 transaction만 side effect 생성
- 함수 실행 권한이 `authenticated`에만 있고 `anon`에는 없음

기존 request moderation RPC의 transaction 및 concurrency 테스트는 재사용한다. docs 화면에는 target mapping과 UI 결과에 집중한 presentation 테스트를 추가한다.

## 10. 예상 파일 구조

### 새 파일

- `src/modules/word-moderation/application/docs-word-moderation-types.ts`
- `src/modules/word-moderation/application/delete-word-directly.ts`
- `src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts`
- `src/modules/word-moderation/presentation/use-docs-word-moderation.ts`
- 대응하는 Domain/Application/Infrastructure/Presentation 테스트
- `src/__tests__/words-docs/[id]/Table.test.tsx`
- `supabase/migrations/20260822120000_direct_word_deletion.sql`
- `supabase/tests/database/direct-word-deletion.integration.sql`

### 수정 또는 분리 파일

- `src/app/words-docs/[id]/DocsDataPage.tsx`
- `src/app/words-docs/[id]/DocsDataHome.tsx`
- `src/app/words-docs/[id]/Table.tsx`
- `src/app/words-docs/[id]/WorkModal.tsx`
- `src/app/words-docs/[id]/TableWorkFunc.tsx`
- `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- `src/modules/word-moderation/index.ts`
- 대체된 legacy SCM interface 및 구현 메서드
- `docs/architecture/ddd-lite-migration-roadmap.md`

구현 계획에서 실제 재사용처를 다시 검색한 뒤 legacy 메서드별 삭제 가능 여부를 확정한다. 다른 기능이 사용하는 SCM 메서드는 제거하지 않는다. 자동 생성된 `src/app/types/database.types.ts`는 직접 수정하지 않는다.

## 11. 검증과 운영

코드 검증:

```bash
npm run lint
npx tsc --noEmit
npx jest src/__tests__/modules/word-moderation src/__tests__/words-docs --runInBand
```

DB 변경 검증:

```bash
supabase start
# forward migration 및 direct-word-deletion integration test 실행
supabase stop
```

로컬 Supabase는 성공 또는 실패와 관계없이 작업 종료 시 중지한다. 원격 프로젝트와 `--linked` 대상에는 적용하지 않는다.

## 12. 완료 조건

- docs 화면의 관리자 요청 승인·반려가 기존 원자적 RPC를 사용한다.
- 관리자 즉시 삭제의 모든 side effect가 하나의 transaction이다.
- 주제 변경 요청이 docs 화면에서 실제로 처리된다.
- 삭제 시 주제 docs 로그가 중복 생성되지 않는다.
- 관리자 버튼은 계속 `admin`에게만 표시된다.
- UI가 안정적인 식별자와 Application 계약만 사용한다.
- `TableWorkFunc.tsx`에 관리자용 직접 SCM mutation 순서가 남지 않는다.
- 사용자 요청 생성·취소 동작은 유지된다.
- 성공·실패·pending에 따른 행과 모달 상태가 테스트로 고정된다.
- 권한, rollback, 로그 정확성, trigger side effect, concurrency가 실제 DB 테스트로 검증된다.
- 관련 Jest, ESLint, TypeScript 검사가 통과한다.
- 로드맵 상태와 다음 행동이 갱신된다.
