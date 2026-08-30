# 사용자 단어 삭제 요청 세로 슬라이스 설계

> 상태: 설계 승인
>
> 기준일: 2026-08-23
>
> 적용 범위: `words-docs/[id]`의 사용자 단어 삭제 요청 및 요청 취소

## 1. 목적

`words-docs/[id]` 화면의 `RequestDelete`, `CancelAddRequest`,
`CancelDeleteRequest`가 전역 `SCM`을 통해 여러 DB 호출을 직접 조정하는 흐름을
DDD-lite 구조로 이전한다. 이번 작업은 Phase 2 사용자 단어 요청 mutation의 첫 세로
슬라이스이며, 이후 단건·대량 단어 추가와 주제 변경 요청을 이전할 때 재사용할
`word-requests` 경계를 만든다.

## 2. 범위

이번 슬라이스는 다음 동작만 포함한다.

- 등록된 단어에 대한 삭제 요청 생성
- 현재 사용자가 만든 pending 단어 요청 취소
- `words-docs/[id]`의 기존 완료·오류 UI 연결
- 대체된 `SCM` import와 호출 제거
- 새 Application 계약과 RPC의 단위·통합 테스트

다음 항목은 포함하지 않는다.

- `word/add/WordAddHome.tsx`의 단어 추가 요청
- `word/adds/WordsAddHome.tsx`의 대량 요청
- `word/search/[query]/WordInfo.tsx`의 요청·취소 및 주제 변경
- 기존 `wait_words` INSERT/DELETE RLS 정책 축소
- 관리자 승인·반려 흐름 변경
- 다른 docs 조회·즐겨찾기 mutation 이전

기존 RLS 정책은 아직 다른 Phase 2 화면이 직접 Data API mutation을 사용하므로 이번
슬라이스에서는 유지한다. 전체 Phase 2 이전이 끝난 뒤 직접 mutation 경로를 잠근다.

## 3. 모듈 경계

새 `src/modules/word-requests` 모듈을 만든다.

- Domain
  - 단어 입력을 문자열로 검증하고 양끝 공백을 제거한다.
  - 정규화 결과가 빈 문자열이면 validation 오류를 반환한다.
- Application
  - `requestWordDeletion({ word })`
  - `cancelWordRequest({ word })`
  - 위 use case가 요구하는 좁은 gateway port와 공개 DTO를 정의한다.
- Infrastructure
  - browser Supabase RPC gateway만 생성 DB 타입과 RPC 이름을 안다.
  - RPC 응답을 Application DTO로 파싱하고 공개 오류를 `ApplicationError`로 매핑한다.
- Presentation
  - React Query mutation hook이 pending 상태와 Application 오류를 관리한다.
  - UI는 이 공개 hook을 통해서만 use case를 호출한다.

관리자 행위 중심의 기존 `word-moderation`에는 사용자 요청 책임을 추가하지 않는다.

## 4. Application 계약

두 command는 클라이언트 사용자 ID나 DB ID를 받지 않는다.

```ts
type RequestWordDeletionCommand = {
    word: string;
};

type CancelWordRequestCommand = {
    word: string;
};

type UserWordRequestResult = {
    requestId: number;
    word: string;
    requestType: 'add' | 'delete';
};
```

삭제 요청 결과의 `requestType`은 항상 `delete`다. 취소 결과는 취소한 요청이 추가
요청인지 삭제 요청인지 알려 주므로 이후 다른 화면에서도 동일 계약을 재사용할 수
있다. `requestedAt`은 현재 화면이 결과에서 사용하지 않으므로 이번 계약에 넣지 않는다.

Application 서비스는 Domain 정규화를 통과한 command만 gateway에 전달한다. gateway가
throw하더라도 presentation hook은 안정적인 infrastructure 오류 결과로 변환한다.

## 5. Database RPC

forward migration에 다음 함수를 추가한다.

### `public.request_word_deletion(p_word text)`

하나의 transaction 안에서 다음 순서로 처리한다.

1. `auth.uid()`가 없으면 `WORD_REQUEST_UNAUTHORIZED`로 실패한다.
2. `btrim(p_word)`가 비어 있으면 `WORD_REQUEST_INVALID_INPUT`으로 실패한다.
3. 동일 단어의 `words` 행을 조회하고 잠근다. 없으면 `WORD_REQUEST_NOT_FOUND`로 실패한다.
4. `wait_words`에 `request_type = 'delete'`, `word_id = words.id`,
   `requested_by = auth.uid()`로 삽입한다.
5. 생성한 `requestId`, `word`, `requestType`을 JSON으로 반환한다.

클라이언트가 `requested_by` 또는 `word_id`를 지정할 수 없게 한다. 동시 중복 요청은
기존 `wait_words.word` unique constraint가 최종 보장하며 `unique_violation`은
`WORD_REQUEST_CONFLICT`로 변환한다.

### `public.cancel_word_request(p_word text)`

하나의 transaction 안에서 다음 순서로 처리한다.

1. `auth.uid()`와 입력을 동일한 규칙으로 검증한다.
2. 정규화된 단어, `requested_by = auth.uid()`, `status = 'pending'`인 요청을 조회하고
   잠근다.
3. 요청이 없으면 `WORD_REQUEST_NOT_FOUND`로 실패한다. 다른 사용자의 요청 여부나
   내부 행 정보는 공개하지 않는다.
4. 선택한 요청 ID로 삭제하고 삭제된 요청의 공개 DTO를 반환한다.

두 함수는 `security definer`, `set search_path = ''`로 선언하고 모든 object를 schema로
한정한다. `authenticated`에만 실행 권한을 부여하고 `anon`과 `public`의 실행 권한은
명시적으로 회수한다. 예상하지 못한 SQL 오류는 서버 로그에 원인을 남길 수 있도록
원래 SQLSTATE를 유지하되, 클라이언트 gateway는 안전한 infrastructure 오류만 노출한다.

## 6. UI 연결

`use-user-word-request-actions.ts`는 새 presentation hook을 사용한다.

- `SCM`, `PostgrestError`, Redux 사용자 객체 의존성을 제거한다.
- 외부 동작 이름을 camelCase인 `requestDelete`, `cancelAddRequest`,
  `cancelDeleteRequest`로 바꾸고 `Table.tsx` 호출부를 함께 갱신한다.
- 추가 요청 취소와 삭제 요청 취소는 같은 `cancelWordRequest` use case를 호출한다.
- 중복 클릭은 React Query pending 상태와 기존 화면 처리 상태를 함께 사용해 차단한다.
- 성공 시에만 기존 `completeWork()`를 호출한다.
- 오류나 예상하지 못한 예외에서도 처리 상태를 해제하고, 안전한 Application 오류를
  기존 Modal에 표시한다.
- UI는 완료 후 기존 데이터 새로고침 경로를 그대로 사용한다.

사용자 경험과 완료 모달 문구는 변경하지 않는다.

## 7. 오류 계약

RPC가 의도적으로 발생시키는 공개 오류 코드는 다음으로 제한한다.

| 코드 | Application kind | 의미 |
| --- | --- | --- |
| `WORD_REQUEST_UNAUTHORIZED` | `unauthorized` | 로그인 세션 없음 |
| `WORD_REQUEST_INVALID_INPUT` | `validation` | 빈 단어 등 잘못된 입력 |
| `WORD_REQUEST_NOT_FOUND` | `not-found` | 등록 단어 또는 취소 가능한 본인 요청 없음 |
| `WORD_REQUEST_CONFLICT` | `conflict` | 동일 단어 요청이 이미 존재함 |
| `WORD_REQUEST_FORBIDDEN` | `forbidden` | 인증됐지만 허용되지 않은 행위 |
| `WORD_REQUEST_INTERNAL_ERROR` | `infrastructure` | 예상하지 못한 처리 실패 |

Infrastructure gateway는 원시 PostgREST 메시지 대신 안전한 한국어 메시지를 포함한
`ApplicationError`를 반환한다. UI Modal은 `ApplicationError.message`를 사용하며 SQL,
table, constraint 이름을 표시하지 않는다.

## 8. 테스트 전략

구현은 TDD로 진행한다.

- Domain 단위 테스트
  - 양끝 공백 제거
  - 빈 문자열 거부
- Application 단위 테스트
  - 정규화한 command 전달
  - validation 실패 시 gateway 미호출
  - gateway 결과 그대로 반환
- Infrastructure 단위 테스트
  - RPC 이름과 `{ p_word }` payload
  - 정상 응답 파싱
  - 잘못된 응답을 infrastructure 오류로 변환
  - 공개 RPC 오류를 `ApplicationError`로 매핑
  - throw를 infrastructure 오류로 변환
- Presentation hook 테스트
  - 삭제 요청과 취소 dispatch
  - pending 상태
  - 실패 결과와 예외 변환
- 화면 action hook 테스트
  - 삭제 요청 성공
  - 추가·삭제 요청 취소 성공
  - 처리 중 중복 호출 차단
  - 실패 시 완료 callback 미호출과 오류 Modal callback 호출
  - 모든 종료 경로에서 처리 상태 해제
- 실제 DB 테스트
  - 비인증 호출 거부
  - `requested_by`가 `auth.uid()`로 저장됨
  - 등록되지 않은 단어 거부
  - 동일 단어 요청 충돌과 동시 요청 단일 성공
  - 본인의 pending 요청 취소 성공
  - 다른 사용자의 요청 취소 불가
  - 실패 시 부분 변경 없음

최종 검증은 관련 Jest 테스트, `npm run lint`, `npx tsc --noEmit`을 실행한다. 로컬
Supabase 테스트 환경을 사용할 수 있으면 새 RPC 통합 테스트도 실행하고, 실행할 수
없으면 미실행 사유를 보고한다.

## 9. 완료 조건

- `words-docs/[id]` 사용자 삭제 요청·취소 경로에 `SCM`, Supabase SDK, 생성 DB 타입
  import가 없다.
- UI가 사용자 UUID, table, column, RPC payload를 알지 못한다.
- RPC가 사용자 ID와 등록 단어 ID를 서버에서 결정한다.
- 중복 요청과 본인 요청 취소가 DB에서 최종 보장된다.
- 성공·실패 시 기존 Modal 흐름이 유지되고 처리 상태가 남지 않는다.
- 관련 Jest, lint, TypeScript 검사가 통과한다.
- 가능한 환경에서 실제 DB 권한·rollback·동시성 테스트가 통과한다.
- 로드맵의 사용자 단어 요청 상태를 `부분 완료`로 갱신하고 다음 Phase 2 화면을 기록한다.
