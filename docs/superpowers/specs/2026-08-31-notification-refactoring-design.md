# 공지사항 Server Action·ISR·조회수 리팩터링 설계

## 1. 배경

GitHub 이슈 #142는 공지사항에 조회수를 추가하고, 생성·수정·삭제를 Server Action으로 옮기며, 공지 본문을 ISR로 캐시한 뒤 변경 시 `revalidatePath`로 무효화할 것을 요구한다.

현재 공지 목록은 `revalidate = 60`을 선언하지만 쿠키 기반 Supabase 서버 클라이언트를 사용한다. 상세·metadata·편집 조회는 React `cache`로 한 요청 안에서만 중복을 제거하고 교차 요청 캐시는 사용하지 않는다. 생성·수정·삭제와 이미지 Storage 작업은 브라우저 Supabase 클라이언트에서 실행된다.

본문 조회에 조회수 증가를 결합하면 ISR cache hit에는 증가하지 않고 cache miss 또는 재생성 때만 증가한다. 따라서 캐시 가능한 공개 콘텐츠 조회, 요청마다 실행할 조회수 명령, 인증이 필요한 관리자 쓰기를 서로 분리한다.

## 2. 목표

- 공지 상세 화면이 정상적으로 마운트될 때마다 조회수를 한 번 증가시킨다. 같은 사용자의 새로고침과 재방문도 각각 새 조회로 센다.
- 조회수는 상세 화면의 작성일 옆에만 표시한다.
- 공개 공지 상세와 metadata를 60초 ISR 데이터 캐시에서 제공한다.
- 공지 목록의 기존 60초 ISR 의도가 실제로 동작하도록 공개 조회에서 요청 쿠키 의존성을 제거한다.
- 생성·수정·삭제와 이미지 처리를 인증된 Server Action으로 이동한다.
- 공지 변경 성공 직후 관련 목록·상세 경로를 `revalidatePath`로 무효화한다.
- 기존 Application service, `Result<ApplicationError>` 계약, 이미지 롤백·정리 정책과 Modal UX를 보존한다.

## 3. 범위 밖

- 사용자·세션·IP별 중복 조회 제거
- 조회수의 목록 노출, 조회수 정렬 또는 인기 공지 기능
- 조회수 증가에 따른 ISR 무효화
- 공지 작성·상세 화면의 전반적인 UI 재설계
- 전역 공지 Modal의 1분 React Query stale 정책 변경
- 기존 `r4`·`admin` RLS 권한 또는 관리자 전용 UI 노출 정책 변경
- 이미지 garbage collection을 완전한 동시성 보장 방식으로 교체
- `database.types.ts` 수동 편집

## 4. 전체 아키텍처

공지사항 흐름을 세 경계로 나눈다.

```text
상세 방문 -> ISR 본문 조회 -> 즉시 렌더
                       \-> 조회수 Server Action -> 원자 증가 -> 화면 숫자 갱신

관리자 저장/삭제 -> 인증 -> 기존 Application service
                         |-> Supabase DB/Storage
                         \-> 성공 시 목록·상세 ISR 무효화
```

### 4.1 캐시되는 공개 읽기

공개 anon Supabase 클라이언트는 `cookies()`를 호출하지 않는다. 공지 상세 loader는 이 클라이언트와 `unstable_cache`를 사용해 ID별 결과를 60초 동안 유지한다. 함수 인자인 공지 ID는 cache key의 일부가 되며, 고정 key prefix는 공지 상세 namespace를 구분한다.

상세 페이지와 `generateMetadata`는 React `cache`로 감싼 동일 loader를 사용한다. React cache는 한 RSC 요청 내 중복 호출을 제거하고, `unstable_cache`는 요청 사이의 ISR 데이터 캐시를 담당한다.

편집 페이지는 캐시된 공개 loader를 사용하지 않는다. 쿠키 기반 서버 클라이언트로 최신 row를 조회해 편집 시작부터 오래된 초기값을 제공하지 않는다. 기존 이미지 URL 조건부 update는 저장 시점의 동시 변경도 계속 탐지한다.

목록 페이지의 공개 조회도 anon 클라이언트를 사용한다. 목록의 기존 `revalidate = 60`은 유지한다. 목록 projection에는 조회수를 추가하지 않는다.

### 4.2 캐시되지 않는 조회수 명령

상세 projection에 `views`를 추가한다. 상세 UI는 캐시된 초기값을 먼저 렌더링하고, 마운트 후 조회수 Server Action을 호출한다. 액션이 반환한 DB 최신 값을 로컬 state에 반영하므로 초기 ISR 값이 오래되었어도 현재 방문자는 증가 후 값을 볼 수 있다.

ID별 mount당 한 번만 호출하도록 client effect에 ref guard를 둔다. 공지 ID가 바뀌면 새 ID는 별도 조회로 기록한다. 이 guard는 한 mount의 effect 중복 실행을 막을 뿐, 새로고침·재방문·새 mount를 중복 제거하지 않는다.

조회수 기록은 best-effort다. 실패하면 초기 ISR 값을 유지하고 본문 렌더링, 탐색, 관리자 기능을 방해하거나 오류 Modal을 열지 않는다. 조회수 증가 때 `revalidatePath`나 tag 무효화를 수행하지 않는다.

### 4.3 인증된 관리자 쓰기

`saveNotificationAction`, `deleteNotificationAction`, `recordNotificationViewAction`을 `'use server'` 진입점에서 제공한다. Server Action은 외부에서 호출 가능한 서버 endpoint로 취급하고 입력을 신뢰하지 않는다.

저장·삭제 액션은 Supabase `getUser()`로 인증 주체를 확인하고 DB의 기존 권한과 동일하게 `r4` 또는 `admin` role만 허용한다. 프런트엔드의 작성·수정·삭제 버튼과 화면은 기존처럼 `admin`에게만 노출한다. 실제 DB 작업에도 사용자 세션이 포함된 서버 Supabase 클라이언트를 전달해 RLS를 최종 권위로 유지한다.

액션은 기존 `SaveNotificationService`와 `DeleteNotificationService`를 호출한다. 새 이미지 upload 실패, DB 저장 실패 후 새 object rollback, replace/remove/delete 후 남은 참조 확인, 관리 대상 URL 판별과 best-effort 정리 동작을 보존한다.

## 5. 데이터베이스 변경

forward migration 하나에 다음 변경을 넣는다.

- `notification.views bigint not null default 0`
- `views >= 0` check constraint
- `increment_notification_views(p_notification_id bigint) returns bigint` 함수

증가 함수는 `UPDATE public.notification SET views = views + 1 ... RETURNING views`로 갱신과 최신 값 반환을 한 statement에서 수행한다. 존재하지 않는 ID에는 row가 없음을 나타내는 값을 반환하며, gateway가 이를 `not-found`로 변환한다.

함수는 공개 조회 기록을 위해 anon과 authenticated role에서 실행할 수 있어야 한다. `SECURITY DEFINER`를 사용할 경우 빈 `search_path`를 고정하고 모든 객체를 schema-qualified 이름으로 참조한다. 함수는 전달된 양의 ID의 조회수 증가 외에는 어떤 row나 컬럼도 변경하지 않는다.

기존 row는 컬럼 default에 따라 조회수 `0`에서 시작한다. 마이그레이션 적용 뒤 `npm run gen-type`으로 Supabase 타입을 재생성하며 생성 파일은 직접 편집하지 않는다.

## 6. 모듈과 파일 경계

### 6.1 Application

`src/modules/notifications/application/`에 조회수 command port와 `RecordNotificationViewService`를 추가한다. 서비스는 양의 safe integer만 허용하고 gateway 결과를 기존 `Result` 계약으로 반환한다.

`NotificationDetailProjection`에만 `views`를 추가한다. `NotificationListItem`과 `ModalNotice` 계약은 바꾸지 않는다. 기존 저장·삭제 서비스의 공개 계약과 orchestration은 유지한다.

### 6.2 Infrastructure

`src/modules/notifications/infrastructure/server/`는 다음 조합을 제공한다.

- 쿠키 없는 공개 공지 목록·상세 query composition
- 쿠키 기반 인증·쓰기·삭제·Storage composition
- 조회수 RPC command gateway
- 60초 상세 cached loader와 요청 단위 memoized loader

서버 전용 composition과 client factory는 `server-only`로 표시한다. 현재 browser 폴더에 있는 쓰기, 삭제, 이미지 참조, 이미지 Storage adapter는 Supabase client를 생성자에서 받는 환경 중립 adapter로 이동하거나 서버 전용 adapter로 교체한다. 같은 로직을 브라우저와 서버에 복제하지 않는다.

브라우저 notification composition에는 전역 Modal 조회만 남긴다. 더 이상 소비되지 않는 브라우저 저장·삭제 gateway와 composition 항목은 제거한다.

### 6.3 Server Actions와 presentation

`src/app/notification/actions.ts`에는 async Server Action export만 둔다. 인증, FormData parsing, service composition처럼 별도 테스트가 필요한 보조 로직은 notifications 서버 모듈에 둔다.

`useSaveNotification`과 `useDeleteNotification`의 컴포넌트 대상 공개 API는 유지한다. 내부에서 command를 FormData로 직렬화해 Server Action을 호출하고, 성공 시 기존 `notificationQueryKeys.activeList`를 무효화한다. 따라서 `NotificationWriteForm`과 상세 삭제 Modal의 상태 흐름은 최소 변경으로 유지된다.

상세 화면에는 작성일과 조회수를 묶어 표시하는 작은 client component를 둔다. `Eye` 아이콘과 숫자를 사용하고 별도 성공·실패 알림은 추가하지 않는다.

## 7. Server Action 입력과 이미지 제한

저장 action은 FormData의 mode, ID, 기대 이미지 URL, 제목, 본문, 종료일, boolean flag, 이미지 변경 종류와 선택 파일을 명시적으로 parse한다. 누락, 중복, 잘못된 enum·boolean·ID·날짜, mode와 맞지 않는 필드 조합은 Application service 호출 전에 `validation`으로 거부한다. Application service도 도메인 검증을 다시 수행한다.

Server Action 요청 본문의 기본 제한은 1MB이므로 이미지 최대 크기를 5MB로 정의한다. 클라이언트는 선택·제출 전에 5MB 초과 파일을 거부하고, 서버 action도 `File.size`를 다시 검증한다. `next.config.ts`의 `serverActions.bodySizeLimit`은 FormData overhead를 포함해 `6mb`로 설정한다. 제한 초과는 기존 Error Modal에 안전한 한국어 validation 메시지로 표시한다.

허용 이미지 MIME 정책은 기존 `accept="image/*"` 동작을 보존하되 서버에서도 `image/` prefix를 검증한다. 파일명 sanitize와 `upsert: false` 정책은 기존 Storage adapter를 그대로 사용한다.

## 8. 캐시 무효화

Server Action은 DB·Storage Application service가 성공한 뒤에만 경로를 무효화한다.

- 생성: `revalidatePath('/notification')`
- 수정: `revalidatePath('/notification')`, `revalidatePath('/notification/{id}')`
- 삭제: `revalidatePath('/notification')`, `revalidatePath('/notification/{id}')`

특정 상세 URL을 사용해 해당 공지만 무효화한다. 실패한 명령은 기존 유효한 캐시를 제거하지 않는다. 조회수 action은 본문 캐시를 무효화하지 않는다.

관리자 자신의 전역 Modal React Query cache는 기존 hook의 성공 후 invalidation으로 갱신한다. 다른 사용자의 전역 Modal은 기존 1분 stale policy에 따라 갱신되며 이번 범위에서 별도 broadcast나 tag 체계를 추가하지 않는다.

## 9. 오류 처리

모든 action은 throw 가능한 infrastructure 세부 정보를 클라이언트로 전달하지 않고 직렬화 가능한 `Result`를 반환한다.

- 세션 없음: `unauthorized`
- 인증됐지만 role 부족: `forbidden`
- 잘못된 ID, FormData, 날짜 또는 파일: `validation`
- modal 기간 중첩 또는 stale 이미지: 기존 `conflict`
- 공지 없음: `not-found`
- Supabase DB, Storage, RPC 오류: 안전한 `infrastructure`

저장·삭제 오류는 기존 Error Modal에 표시한다. 완료 Modal과 이동 동작도 유지한다. 조회수 오류만 조용히 무시한다. 서버 로그가 필요하면 안전한 문맥만 기록하고 access token, 원본 PostgREST 오류, 파일 내용은 기록하지 않는다.

## 10. 테스트

### 10.1 데이터베이스 통합 테스트

- 새 공지의 조회수가 0으로 시작한다.
- RPC 호출마다 정확히 1 증가하고 증가 후 값을 반환한다.
- 여러 호출의 증가분이 유실되지 않는다.
- 없는 ID와 잘못된 ID를 안전하게 처리한다.
- check constraint가 음수 값을 거부한다.
- anon과 authenticated 실행 권한이 의도와 일치한다.

### 10.2 Application·Infrastructure 테스트

- 조회수 service가 유효하지 않은 ID를 gateway 전에 거부한다.
- RPC gateway가 최신 bigint를 반환하고 malformed, not-found, 반환 오류와 throw를 안정적인 오류로 변환한다.
- 상세 query가 `views`를 선택·검증·투영한다.
- 목록 query는 조회수를 선택하거나 공개 계약에 노출하지 않는다.
- 공개 query composition이 쿠키 기반 client를 사용하지 않는다.
- metadata와 상세 page는 같은 요청에서 중복 조회하지 않는다.
- 60초 안의 교차 요청은 같은 상세 cache entry를 사용한다.
- 편집 query는 공개 ISR loader와 분리되어 매 요청 최신 row를 읽는다.

### 10.3 Server Action 테스트

- 미인증과 권한 부족 요청을 DB·Storage 호출 전에 거부한다.
- `r4`와 `admin`은 기존 RLS 범위에서 저장·삭제할 수 있다.
- malformed FormData와 5MB 초과·비이미지 파일을 거부한다.
- 성공한 생성·수정·삭제만 정확한 경로를 무효화한다.
- 조회수 성공·실패 모두 ISR 경로를 무효화하지 않는다.
- 기존 이미지 rollback, stale 이미지 conflict와 참조 기반 정리 결과를 보존한다.

### 10.4 UI 테스트

- 상세 작성일 옆에 초기 조회수를 표시한다.
- 같은 ID의 한 mount에서 조회수 action을 한 번만 호출한다.
- action이 반환한 최신 값을 반영한다.
- 기록 실패 시 초기 숫자와 본문을 유지한다.
- 저장·삭제 hook이 기존 pending guard와 React Query invalidation을 유지한다.
- 5MB 초과 파일은 기존 Error Modal 계약으로 안내한다.
- 기존 작성·수정·삭제 완료 Modal과 이동 흐름을 유지한다.

## 11. 배포와 검증

애플리케이션이 새 컬럼과 RPC를 사용하기 전에 Supabase schema가 준비되어야 한다.

1. forward migration을 Supabase에 적용한다.
2. `npm run gen-type`으로 원격 schema 타입을 재생성한다.
3. 애플리케이션을 배포한다.
4. 실제 환경에서 생성, 상세 진입별 조회 증가, 수정 직후 새 본문, 삭제 후 404를 점검한다.

코드 변경 후 다음 검증을 실행한다.

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

DB 통합 테스트를 별도 파일로 추가하고 로컬 Supabase가 사용 가능하면 해당 SQL suite도 실행한다. 실행하지 못한 검증은 이유와 함께 보고한다.

## 12. 완료 조건

- 공지 상세가 정상 마운트될 때마다 DB 조회수가 정확히 한 번 증가한다.
- 새로고침과 재방문은 새 조회로 집계된다.
- 상세 화면은 작성일 옆에 증가 후 최신 조회수를 표시한다.
- 상세 본문과 metadata는 60초 ISR cache를 공유하고 편집 페이지는 최신 row를 조회한다.
- 생성·수정·삭제는 인증과 RLS를 통과한 Server Action에서만 실행된다.
- 성공한 변경은 관련 목록·상세 경로를 즉시 무효화한다.
- 조회수 기록은 본문 cache를 깨거나 본문 열람을 실패시키지 않는다.
- 기존 이미지 안전 정리와 사용자 Modal 흐름에 회귀가 없다.
