# 재개 가능한 관리자 단어 대량 삭제 설계

## 1. 목적

`/admin/del-words`의 브라우저 주도 다중 테이블 변경을 `word-moderation` 세로 슬라이스와 PostgreSQL transaction RPC로 이전한다. 단어 삭제, moderation 로그, docs 로그, 기여도, 요청 정리, docs 최근 수정 시각이 한 batch 안에서 함께 commit 또는 rollback되게 하고, 네트워크 중단이나 새로고침 이후에도 중복 부작용 없이 재개할 수 있게 한다.

이번 작업은 `admin/del-words` 한 사용자 행동만 다룬다. `admin/request-words`, `TableWorkFunc`, 하드코딩된 reference docs ID의 의미 키 전환, 전체 fresh bootstrap 정리는 범위에 포함하지 않는다.

## 2. 현재 동작과 의도적 변경

현재 `DelWordsHome.tsx`는 파일의 각 줄을 단어로 사용하고 다음 작업을 브라우저에서 순차 실행한다.

1. 전체 docs와 삭제 대기 요청을 조회한다.
2. 입력 단어와 주제 관계를 청크 조회한다.
3. 숫자로만 구성된 theme code를 가진 단어를 삭제 대상에서 제외한다.
4. 단어 로그와 글자·주제 docs 로그를 먼저 삽입한다.
5. 단어를 청크 삭제한다.
6. 영향받은 docs의 최근 수정 시각과 사용자 기여도를 갱신한다.

중간 호출이 실패하면 로그만 남거나 일부 단어만 삭제될 수 있다. 재시도하면 로그와 기여도가 중복될 수도 있다.

다음 동작은 유지한다.

- 입력 파일은 줄 단위 단어 목록이다.
- 숫자로만 구성된 theme code가 하나라도 연결된 단어는 보호되어 삭제되지 않는다.
- 존재하지 않는 단어는 오류로 전체 작업을 중단하지 않는다.
- 삭제된 단어에는 승인 상태의 `delete` moderation 로그를 남긴다.
- 글자 docs와 연결된 주제 docs에 `delete` 로그를 남긴다.
- 기존 word delete trigger가 생성하는 특수 reference docs 로그와 통계 부작용은 유지한다.

다음 동작은 로드맵 원칙에 따라 의도적으로 변경한다.

- 기여도는 조회된 단어 수가 아니라 실제 삭제된 단어 수만 반영한다.
- 삭제 요청자가 있으면 해당 요청자에게 단어당 1점을 부여한다.
- 삭제 요청자가 없으면 처리 관리자에게 단어당 1점을 부여한다.
- 클라이언트가 보낸 사용자 ID는 권한 또는 감사 actor의 근거로 사용하지 않는다.

## 3. 선택한 접근

삭제 전용 operation과 batch를 추가하고, 기존 단어 추가 승인 구조의 검증된 패턴을 재사용한다.

기존 `word_approval_operations`를 범용 테이블로 변경하는 방안은 이미 동작 중인 추가 승인 경로와 migration을 넓게 건드린다. 단일 무상태 삭제 RPC를 청크 반복하는 방안은 commit 이후 응답 유실 시 정확히 한 번의 로그와 기여도를 보장하지 못한다. 따라서 `word_deletion_operations`와 `word_deletion_batches`를 별도로 두어 변경 범위와 장애 격리를 명확하게 유지한다.

향후 moderation operation이 더 늘어나 공통 구조의 변경 비용보다 중복 비용이 커진다는 근거가 생기면 별도 migration으로 일반화한다. 이번 작업에서는 추상화를 선행하지 않는다.

## 4. 계층과 파일 책임

### Domain

`src/modules/word-moderation/domain/word-deletion.ts`

- raw 문자열 배열을 삭제 단어 목록으로 정규화한다.
- 각 줄 끝의 `\r`을 제거한다.
- 빈 줄을 제거한다.
- 동일 단어를 최초 등장 기준으로 중복 제거한다.
- 단어 앞뒤 공백은 자동으로 제거하지 않고 validation 오류로 처리한다.
- batch 최대 크기를 정의하고 결정적인 순서로 분할한다.
- Supabase, React, 생성 DB 타입을 import하지 않는다.

### Application

다음 파일을 삭제 전용으로 둔다.

- `word-deletion-types.ts`: command, operation, batch result, progress, IndexedDB job DTO
- `word-deletion-payload.ts`: 직렬화와 SHA-256 input/batch hash 생성
- `word-deletion-ports.ts`: operation gateway와 job store 계약
- `run-word-deletion.ts`: 시작, 재개, 취소, batch 실행, authoritative result 집계

Application은 `Result<T>`와 `ApplicationError`만 반환한다. RPC 이름, table 이름, Supabase 오류 타입을 알지 않는다.

### Infrastructure

- `supabase-word-deletion-gateway.ts`: browser Supabase client로 삭제 RPC를 호출하고 응답을 검증·매핑한다.
- `word-deletion-job-db.ts`: `word-deletion-jobs` IndexedDB store에 재개 payload를 저장한다.
- `browser-word-moderation-services.ts`: 기존 composition root에 삭제 서비스를 추가한다.

생성된 `database.types.ts`는 수동 수정하지 않는다. 새 RPC가 아직 생성 타입에 없으므로 기존 승인 gateway와 같은 제한된 경계에서 명시적인 RPC argument/result 타입 narrowing을 사용한다.

### Presentation

- `use-word-deletion.ts`: React Query mutation, pending job query, 진행률, 안정적인 오류 상태를 소유한다.
- `WordDeletionPanel.tsx`: 파일 선택·drag and drop·미리보기·진행·재개·취소 UI를 담당한다.
- `DelWordsHome.tsx`: 페이지 레이아웃과 `WordDeletionPanel` 조립만 담당한다.

Presentation은 `SCM`, Supabase SDK, table/column/RPC 이름을 import하지 않는다.

## 5. 입력과 결과 계약

정규화된 batch payload는 문자열 배열이 아니라 명시적인 object 배열을 사용한다.

```ts
interface NormalizedWordDeletionEntry {
    word: string;
}
```

한 batch의 최대 크기는 50개다. DB도 같은 상한을 재검증한다.

RPC batch 결과는 다음 의미를 가진다.

```ts
interface DeleteWordBatchResult {
    deletedWordCount: number;
    protectedWordCount: number;
    missingWordCount: number;
    processedRequestCount: number;
    affectedDocsIds: number[];
}
```

- `deletedWordCount`: 해당 batch에서 실제 삭제한 단어 수
- `protectedWordCount`: 숫자 theme code 때문에 삭제하지 않은 존재 단어 수
- `missingWordCount`: RPC 실행 시점에 존재하지 않은 입력 단어 수
- `processedRequestCount`: cascade 또는 명시 삭제로 제거된 삭제 요청 수
- `affectedDocsIds`: 직접 생성한 글자·주제 docs 로그로 영향받은 고유 docs ID

최종 결과는 DB에 기록된 완료 batch 결과를 batch index 순서로 합산한다. `affectedDocsIds`는 중복 제거한다.

## 6. DB 모델과 RPC

forward migration 하나에 다음 객체를 추가한다.

### 테이블

`public.word_deletion_operations`

- `operation_id uuid primary key`
- `actor_id uuid not null references public.users(id)`
- `input_hash text not null`
- `total_entries integer not null`
- `total_batches integer not null`
- `status text not null check (running, completed, cancelled)`
- 생성·갱신 시각
- 같은 actor와 input hash의 실행 중 operation을 하나로 제한하는 partial unique index

`public.word_deletion_batches`

- `(operation_id, batch_index)` primary key
- `payload_hash text not null`
- `entry_count integer not null`
- `result jsonb not null`
- 생성 시각
- operation 삭제 시 cascade

RLS는 활성화하고 직접 table 접근 policy는 만들지 않는다. 클라이언트는 RPC로만 접근한다.

### 공개 RPC

- `start_word_deletion_operation(uuid, text, integer, integer) -> jsonb`
- `get_word_deletion_operation(uuid) -> jsonb`
- `apply_word_deletion_batch(uuid, integer, integer, text, jsonb) -> jsonb`
- `cancel_word_deletion_operation(uuid) -> jsonb`

함수는 `SECURITY DEFINER`, 고정된 `search_path`, schema-qualified object를 사용한다. `PUBLIC`과 `anon`의 EXECUTE를 회수하고 `authenticated`, `service_role`에만 필요한 EXECUTE를 부여한다. 함수 내부에서 `auth.uid()`와 `public.users.role IN ('r4', 'admin')`를 재검증한다.

## 7. batch transaction 흐름

`apply_word_deletion_batch`는 다음 순서로 실행한다.

1. 인증 actor와 관리자 역할을 확인한다.
2. operation row를 잠그고 actor, 상태, batch 순서, total batch 수를 검증한다.
3. 동일 batch index가 이미 있으면 같은 hash에 기존 결과를 반환하고 다른 hash는 conflict로 거절한다.
4. JSON 구조, 1~50개 크기, 단어 문자열, 중복, 공백을 검증한다.
5. 대상 `words`, 삭제형 `wait_words`, 삭제형 `word_themes_wait`, 관련 `word_themes`를 결정적인 순서로 잠근다.
6. 누락 단어와 숫자 theme code가 연결된 보호 단어를 분류한다.
7. 실제 삭제 단어별 기여자를 가장 오래된 삭제형 `wait_words.id`의 `requested_by`, 없으면 actor로 결정한다.
8. 실제 삭제 단어에 moderation 로그를 삽입한다.
9. 글자 docs와 주제 docs 로그를 삽입한다. 주제 로그 actor는 단어 삭제 요청자, 해당 주제 삭제 요청자, 처리 관리자 순서로 결정한다.
10. 삭제 요청 수를 계산한 뒤 실제 단어를 삭제한다. FK cascade와 기존 trigger 부작용도 같은 transaction에 포함된다.
11. 실제 삭제 단어의 기여자별 건수를 집계해 `increment_contribution`을 호출한다.
12. 직접 영향받은 docs의 최근 수정 시각을 갱신한다.
13. batch result를 삽입하고 마지막 batch면 operation을 `completed`로 갱신한다.
14. 결과를 반환한다.

어느 단계에서든 실패하면 batch의 모든 변경을 rollback한다. 동시에 겹치는 삭제는 word row lock과 실제 `DELETE ... RETURNING` 결과를 기준으로 하므로 단어 로그·기여도는 한 번만 생성된다.

## 8. 오류 계약

공개 DB 오류 code는 다음과 같다.

- `WORD_DELETION_UNAUTHORIZED`
- `WORD_DELETION_FORBIDDEN`
- `WORD_DELETION_NOT_FOUND`
- `WORD_DELETION_CONFLICT`
- `WORD_DELETION_INVALID_INPUT`
- `WORD_DELETION_INTERNAL_ERROR`

adapter는 이를 각각 `unauthorized`, `forbidden`, `not-found`, `conflict`, `validation`, `infrastructure`로 변환한다. 예상하지 못한 SQL 오류 원문, relation 이름, stack trace는 UI에 전달하지 않는다.

## 9. UI 동작

- 파일이 없으면 기존 inline 오류를 유지한다.
- 유효한 단어가 없으면 validation 메시지를 표시하고 RPC를 호출하지 않는다.
- 시작 시 Modal에서 validation/application 진행률을 표시한다.
- 완료 후 삭제·보호·누락 건수를 표시한다.
- 처리 중 Modal은 임의로 닫지 못하게 한다.
- 저장된 미완료 작업이 있으면 입력 hash와 생성 시각을 표시하고 재개 또는 취소할 수 있게 한다.
- 오류는 프로젝트 `ErrorModal`을 사용하고 안정적인 Application 메시지만 표시한다.
- Redux에는 삭제 업무 상태를 추가하지 않는다.

## 10. 테스트 전략

### Characterization/Presentation

- 파일 미선택 오류
- 파일 선택과 미리보기
- 삭제 시작 시 hook command 전달
- 진행률과 완료 결과 표시
- application 오류 Modal
- pending job 재개·취소
- `DelWordsHome`과 panel에 `SCM` 또는 Supabase import가 없는 경계

### Domain/Application

- CR과 빈 줄 제거
- 최초 등장 기준 중복 제거
- 공백 입력 거절
- 50개 batch 분할
- 결정적 input/batch hash
- 시작·재개·취소
- 완료 batch 건너뛰기
- operation/payload/hash conflict
- authoritative 결과 집계
- 실패 이후 IndexedDB job 보존과 성공 이후 제거

### Infrastructure

- RPC argument mapping
- 정상 응답 runtime validation
- 잘못된 응답을 infrastructure 오류로 변환
- 공개 DB 오류 code mapping
- 삭제 job 전용 IndexedDB namespace

### 실제 local Supabase

pgTAP 테스트는 다음을 검증한다.

- JWT actor 누락과 일반 사용자 거부
- `anon` EXECUTE 권한 없음과 고정 `search_path`
- 정상 삭제의 logs/docs_logs/contribution/docs update/request cleanup
- 삭제 요청자 우선, 요청이 없을 때 관리자 fallback
- 숫자 theme code 보호
- 존재하지 않는 단어 집계
- 같은 hash replay의 exact-once 부작용
- 다른 hash conflict
- 중간 로그 실패 시 전체 rollback
- 취소된 operation 실행 거부
- 서로 겹치는 두 operation의 동시 삭제 exact-once

로컬 수명주기는 `supabase start` → migration/reset 및 pgTAP → `supabase stop`으로 고정한다. `--linked`와 원격 project connection은 사용하지 않는다.

## 11. 검증과 완료 조건

- `DelWordsHome` 경로에서 직접 `SCM` import와 호출이 없다.
- 대체된 SCM 메서드는 다른 소비자가 없을 때만 제거한다.
- 새 Domain/Application이 Supabase, React, Next.js, 생성 DB 타입을 import하지 않는다.
- 관련 Jest와 DB integration test가 통과한다.
- `npm run lint`, `npx tsc --noEmit`, `npm run test`가 통과한다.
- 로컬 Supabase는 작업 종료 시 중지한다.
- architecture roadmap의 `admin/del-words` 상태와 테스트 문서를 갱신한다.
- 원격 클라우드 Supabase에는 이번 작업 중 migration을 적용하지 않는다.

## 12. 클라우드 Supabase 반영 원칙

작업 완료 후 사용자가 적용할 수 있도록 다음 정보를 제공한다.

- 새 forward migration 파일과 선행 migration
- 로컬에서 통과한 DB/Jest/lint/type-check 결과
- 원격 적용 전 migration history와 백업 확인 항목
- `supabase db push`를 사용할 경우 반드시 의도한 project link를 확인하는 절차
- 적용 후 함수 존재, 권한, smoke query, 애플리케이션 동작 확인 항목
- rollback이 필요할 때 사용할 별도 forward migration 대상 객체

원격 적용 명령은 안내만 하고 이 구현 세션에서는 실행하지 않는다.
