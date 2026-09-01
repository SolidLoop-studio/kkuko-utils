# PostgreSQL + NestJS API 스트랭글러 마이그레이션 설계

> 상태: 설계 승인, 1차 구현 계획 작성 완료
>
> 기준일: 2026-09-01
>
> 적용 범위: Kkuko Utils의 Supabase Database 의존성 제거, 이후 Storage와 Auth 제거를 위한 전환 구조

## 1. 목적

Kkuko Utils는 현재 Supabase의 PostgreSQL, Data API, Database RPC, RLS, Auth,
Storage를 사용한다. Supabase 비용 부담을 줄이기 위해 별도 PostgreSQL과 NestJS API
서버를 구축하고, 기능별 스트랭글러 방식으로 데이터 접근을 이전한다.

전환 목표는 다음 순서를 따른다.

1. Supabase Auth와 Storage는 유지하고 Database/Data API만 먼저 분리한다.
2. NestJS가 모든 신규 PostgreSQL 접근과 최종 인증·인가를 담당한다.
3. 낮은 결합도의 notification부터 기능별 HTTP gateway로 전환한다.
4. words/docs처럼 같은 transaction에 속하는 영역은 하나의 source-of-truth
   cutover 단위로 이전한다.
5. Supabase Database 의존성 제거 후 Storage를 이전한다.
6. Auth는 가장 마지막에 이전한다.

이 문서는 전체 전환 방향과 각 단계의 경계, DB 함수·트리거 처리 원칙,
notification 첫 슬라이스, 데이터 이관, 검증, 보안 및 운영 기준을 정의한다.
구현은 한 번의 대형 작업으로 진행하지 않고, 이 문서를 기준으로 하위 프로젝트별
구현 계획을 별도로 작성한다.

## 2. 현재 상태에서 확인된 사실

### 2.1 이미 존재하는 유리한 경계

현재 저장소는 여러 기능이 다음 DDD-lite 구조로 분리되어 있다.

```text
UI / Hook / Server Action
        ↓
Application Service
        ↓
Query 또는 Command Port
        ↓
Supabase Infrastructure Gateway
```

따라서 UI와 application service를 유지한 채 Supabase gateway 옆에 HTTP gateway를
추가할 수 있다. 확인된 주요 기능 모듈은 다음과 같다.

- notifications
- programs
- release-notes
- identity
- word-catalog
- word-requests
- word-moderation
- docs
- word-logs
- admin-dashboard
- admin-users
- admin-logs
- admin-api-server

Supabase 결합 파일은 docs, identity, notifications, word-moderation,
word-catalog 순으로 많다. notification은 application port와 query/command gateway가
이미 세분되어 있어 첫 이전 대상으로 적합하다.

### 2.2 Supabase 사용 범위

현재 다음 종류의 의존성이 존재한다.

- 브라우저 Supabase client를 통한 테이블 조회와 RPC
- 쿠키 기반 server Supabase client를 통한 RSC/Server Action 조회와 mutation
- service-role client를 통한 서버 전용 조회
- Supabase Auth session 복원, Google OAuth, 로그아웃, middleware 인증
- `public_img` bucket의 공지 이미지
- `public_img/txt/eng_len_6_words.txt` 다운로드
- RLS의 `auth.uid()`, `anon`, `authenticated`, `service_role`
- `SECURITY DEFINER` RPC와 다수의 trigger

### 2.3 스키마 기준선 드리프트

다음 드리프트가 확인되었다.

- `20260831130000_refactor_notifications.sql`은 `notification.views`를 추가한다.
- notification 상세 gateway는 `views`를 읽는다.
- 현재 `src/app/types/database.types.ts`의 `notification.Row`에는 `views`가 없다.
- production 코드에는 `search_words` RPC 호출 흔적이 있으나 생성 타입의 함수
  목록과 차이가 있다.
- 생성 타입에는 `bword`가 있으므로 실제 cloud schema, remote dump, migration 결과의
  일치 여부를 확인해야 한다.

따라서 신규 DB baseline은 생성 타입이나 과거 dump 하나만으로 만들지 않는다.
다음 세 결과를 대조한다.

```text
저장소 migration 전체 적용 결과
+ 실제 Supabase cloud schema dump
+ production 코드의 실제 query/RPC 사용 목록
```

## 3. 목표 아키텍처

```text
┌──────────────────── kkuko-utils / Next.js ────────────────────┐
│ UI / RSC / Server Action                                      │
│          ↓                                                    │
│ 기존 Application Service                                     │
│          ↓                                                    │
│ Query/Command Port                                            │
│          ↓                                                    │
│ Http Feature Gateway ───────────────────────┐                 │
│ Supabase Feature Gateway ← 전환 중 fallback │                 │
└─────────────────────────────────────────────┼─────────────────┘
                                              │ HTTPS
┌──────────────────── NestJS API ─────────────▼─────────────────┐
│ Controller → Auth Guard → Application Service → Repository    │
│                    ↓                             ↓             │
│          Supabase Identity Adapter       pg + Kysely          │
│                                                  ↓             │
│                                             PostgreSQL         │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 책임

- Next.js는 화면, 사용자 상호작용, RSC cache와 현재 Storage orchestration을 담당한다.
- NestJS는 API 입력 검증, 최종 인증·인가, 업무 use case, transaction과 DB 접근을
  담당한다.
- PostgreSQL credential은 NestJS에만 둔다.
- 브라우저와 Next.js에는 DB credential 또는 service-role 성격의 DB secret을 두지
  않는다.
- API는 범용 테이블 CRUD나 Supabase 호환 facade가 아니라 기능별 업무 계약을
  제공한다.
- DB의 snake_case 행과 PostgreSQL 오류 형식을 API 외부에 노출하지 않는다.
- 기능 플래그는 테이블이 아닌 하나의 기능 슬라이스 단위로 전환한다.

### 3.2 채택하지 않는 구조

- 모든 요청을 의무적으로 Next.js BFF에 통과시키지 않는다. 현재 실행 위치가
  서버인 흐름은 서버 HTTP gateway를 사용하고, 브라우저 조회는 필요에 따라 NestJS를
  직접 호출한다.
- `.from()`, `.rpc()`를 흉내 내는 범용 NestJS Data API를 만들지 않는다.
- 서로 다른 DB에 같은 command를 자동 dual-write하지 않는다.
- word와 word_themes처럼 같은 transaction에 속하는 테이블을 장기간 서로 다른
  source of truth로 분리하지 않는다.

## 4. 인증과 인가

### 4.1 초기 인증 흐름

Supabase Auth는 초기 단계에 유지한다. 보호 API는 다음 순서로 처리한다.

```text
Authorization: Bearer <Supabase access token>
        ↓
1. Bearer 형식 검사
2. Supabase를 통한 토큰 유효성 재검증
3. 검증된 user.id/sub 확보
4. Supabase public.users에서 role 조회
5. endpoint 허용 role 검사
6. NestJS application service 실행
7. PostgreSQL query/transaction 실행
```

Next.js의 middleware와 UI 권한 검사는 빠른 리다이렉트와 버튼 노출을 위한 UX
처리이다. 최종 보안 경계는 NestJS이다. NestJS는 Next.js 또는 브라우저가 보낸
사용자 ID와 role header를 신뢰하지 않는다.

### 4.2 인증 port

```ts
interface IdentityVerifier {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity>;
}

interface UserAuthorizationReader {
  getRole(userId: string): Promise<UserRole | null>;
}

interface AuthenticatedIdentity {
  userId: string;
}

type UserRole = 'r1' | 'r2' | 'r3' | 'r4' | 'admin';
```

초기 구현은 `SupabaseIdentityVerifier`와
`SupabaseUserAuthorizationReader`이다. word command와 local users 이전이 끝난 뒤
role reader만 `PostgresUserAuthorizationReader`로 바꾼다. 최종 Auth 이전에서는
identity verifier도 새 OIDC/JWT 구현으로 바꾼다.

### 4.3 오류

| 상황 | HTTP | API 코드 |
| --- | ---: | --- |
| 토큰 없음/형식 오류 | 401 | `AUTH_TOKEN_REQUIRED` |
| 만료·위조·폐기 토큰 | 401 | `AUTH_TOKEN_INVALID` |
| profile/role 없음 | 403 | `USER_ACCESS_DENIED` |
| role 부족 | 403 | `INSUFFICIENT_ROLE` |
| Supabase Auth/role 조회 장애 | 503 | `IDENTITY_PROVIDER_UNAVAILABLE` |

Supabase 장애를 권한 부족으로 위장하지 않는다. access token과 service key는 로그에
남기지 않는다.

### 4.4 현재 권한 차이 보존

현재 `/admin` middleware는 `admin`만 허용하지만 notification RLS와 command
service는 `admin`, `r4`를 허용한다. migration 과정에서 이 차이를 임의로 통일하지
않는다. notification 작성·수정·삭제 API는 기존 동작대로 두 role을 허용한다.

## 5. NestJS와 데이터 계층

### 5.1 기술 선택

- NestJS
- Node.js + TypeScript
- `pg` connection pool
- Kysely query builder
- versioned SQL migration
- 실제 PostgreSQL integration/concurrency test

Prisma 또는 entity-first TypeORM은 기존 함수, trigger, exclusion constraint와 복잡한
SQL을 완전히 표현하지 못하고 raw SQL이 별도로 남기 때문에 기준 도구로 사용하지
않는다.

### 5.2 모듈 구조

```text
src/
├─ common/
│  ├─ auth/
│  ├─ database/
│  ├─ errors/
│  ├─ logging/
│  ├─ observability/
│  └─ validation/
├─ modules/
│  └─ notifications/
│     ├─ application/
│     ├─ domain/
│     ├─ infrastructure/postgres/
│     └─ presentation/http/
├─ migrations/
└─ main.ts
```

HTTP DTO, application type, repository type와 Kysely DB type을 분리한다. SQLSTATE와
Kysely row는 infrastructure 밖으로 노출하지 않는다.

### 5.3 bigint와 timestamp

- PostgreSQL `int8`은 DB adapter에서 string 또는 bigint로 받는다.
- 기존 프런트의 number 계약으로 변환할 때 safe integer를 검사한다.
- 범위를 넘은 값을 조용히 반올림하지 않는다.
- DB와 session timezone은 UTC를 사용한다.
- API timestamp는 UTC ISO 8601 문자열이다.
- 한국 날짜 경계는 서버 OS timezone이 아닌 명시적 `Asia/Seoul` 정책으로 계산한다.
- 시간 의존 application service에는 Clock을 주입한다.

### 5.4 transaction

Kysely transaction 객체를 명시적으로 전달한다. transaction 안에서 외부 HTTP 또는
Storage 호출을 하지 않는다. 기존 RPC 이식을 위한 actor context는 다음 패턴을
사용한다.

```sql
BEGIN;
SELECT set_config('app.actor_id', $1, true);
SELECT public.apply_word_approval_batch(...);
COMMIT;
```

`set_config`의 transaction-local 옵션을 사용하며, 같은 Kysely transaction 객체로
후속 함수를 호출한다. connection pool에 session-level actor를 남기지 않는다.

## 6. notification 첫 슬라이스

### 6.1 API

공개 API:

```http
GET  /v1/notifications
GET  /v1/notifications/active-modal
GET  /v1/notifications/:id
POST /v1/notifications/:id/views
```

관리 API (`admin`, `r4`):

```http
POST   /v1/notifications
PATCH  /v1/notifications/:id
DELETE /v1/notifications/:id
POST   /v1/notifications/image-reference-checks
```

목록은 종료 여부와 무관하게 `isImportant DESC`, `createdAt DESC`, `id DESC`로
정렬한다. 활성 모달은 한국 날짜 마지막 시각을 기준으로 아직 노출 가능한 최신 한
건을 반환한다. 결과가 없으면 `200`과 null payload를 반환한다.

상세 projection은 다음 필드를 제공한다.

```ts
interface NotificationDetail {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  endsAt: string;
  isImportant: boolean;
  isModal: boolean;
  views: number;
}
```

조회 수는 하나의 `UPDATE ... SET views = views + 1 ... RETURNING views`로 처리한다.
현재 의미는 순방문자가 아닌 조회 이벤트 수이며 초기 이전에서 바꾸지 않는다.

### 6.2 입력 검증

- ID는 양의 safe integer이다.
- title과 body는 trim 후 비어 있지 않아야 한다.
- endsAt은 유효한 ISO 8601 timestamp이다.
- imageUrl은 null 또는 HTTP(S) URL이다.
- boolean 필드는 암시적으로 문자열에서 변환하지 않는다.
- 알 수 없는 필드를 거부한다.
- JSON body 크기를 제한한다.
- 현재 데이터와 호환성을 위해 필드별 임의 길이 상한은 첫 cutover에서 추가하지
  않는다.

NestJS ValidationPipe는 whitelist와 unknown field 거부를 사용하고 implicit
conversion을 사용하지 않는다.

### 6.3 PostgreSQL schema

```sql
CREATE TABLE notifications (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    title text NOT NULL,
    body text NOT NULL,
    image_url text,
    ends_at timestamptz NOT NULL,
    is_modal boolean NOT NULL DEFAULT false,
    is_important boolean NOT NULL DEFAULT false,
    views bigint NOT NULL DEFAULT 0,

    CONSTRAINT notifications_views_nonnegative CHECK (views >= 0),
    CONSTRAINT notifications_modal_no_overlap
      EXCLUDE USING gist (
        tstzrange(created_at, ends_at, '[)') WITH &&
      ) WHERE (is_modal)
);

CREATE INDEX notifications_list_idx
  ON notifications (is_important DESC, created_at DESC, id DESC);

CREATE INDEX notifications_active_modal_idx
  ON notifications (ends_at, created_at DESC, id DESC)
  WHERE is_modal = true;

CREATE INDEX notifications_image_url_idx
  ON notifications (image_url)
  WHERE image_url IS NOT NULL;
```

모달 겹침은 애플리케이션의 선행 조회가 아니라 exclusion constraint가 최종적으로
막는다. SQLSTATE `23P01`은 `NOTIFICATION_MODAL_OVERLAP`으로 변환한다.

### 6.4 수정 동시성

초기에는 기존 동작과 같은 image URL compare-and-set을 유지한다.

```sql
UPDATE notifications
SET title = $1,
    body = $2,
    image_url = $3,
    ends_at = $4,
    is_important = $5,
    is_modal = $6
WHERE id = $7
  AND image_url IS NOT DISTINCT FROM $8
RETURNING id, image_url;
```

없는 ID와 stale image를 구분한다. 안정화 후 별도 변경으로 version 컬럼과
`WHERE id = ? AND version = ?`을 도입할 수 있다. 첫 DB cutover와 동시에 동시성
계약을 확대하지 않는다.

### 6.5 Storage 보상 처리

Supabase Storage가 남아 있는 동안 기존 Next.js application service의 순서를
유지한다.

```text
새 이미지 업로드
→ NestJS DB 저장
→ 실패 시 새 이미지 best-effort 삭제
→ 성공 시 이전 URL의 남은 DB 참조 확인
→ 참조가 없을 때만 이전 Storage 객체 삭제
```

DB 저장 성공 후 Storage 삭제 실패는 DB를 rollback하지 않는다. Storage 이전
단계에서 cleanup job/outbox를 도입한다.

## 7. DB 객체 분류

### 7.1 기능별 테이블

| 영역 | 테이블 | 결합도 | 이전 단위 |
| --- | --- | ---: | --- |
| 공지 | notification | 낮음 | 단독 |
| 프로그램·릴리스 | programs, release_note | 낮음 | 각각 |
| 사용자·기여 | users, user_month_contributions | 높음 | identity projection 이후 전환 |
| docs | docs, docs_wait, docs_logs, user_star_docs | 높음 | docs 기능군 |
| 단어·주제 | words, themes, word_themes, 통계·카운트 | 매우 높음 | word aggregate |
| 요청·moderation | wait_words, wait_word_themes, word_themes_wait, logs | 매우 높음 | word command와 함께 |
| batch | word_approval_*, word_deletion_* | 매우 높음 | 해당 command와 함께 |
| 확인 대상 | bword, last_update, words_count | 중간 | 소비자 확인 후 흡수/폐기 |

### 7.2 DB에 유지하는 로직

- PK, FK, unique, check와 exclusion constraint
- 동시성 경쟁에서 지켜야 하는 상태 전이
- 원자 counter 증감
- operation/batch 멱등성 및 exact-once 기록
- word 승인·삭제의 다중 테이블 transaction
- word 통계와 count projection
- docs reference code 불변성
- word 변경과 같은 transaction에 필요한 docs projection 갱신

초기 이식에서 보존할 복합 command는 다음을 포함한다.

- word approval/deletion operation 시작·조회·batch 적용·취소
- word/docs request 승인·거절
- 사용자 word 추가·삭제·주제 변경 요청
- direct word 추가·삭제
- docs favorite 설정

이 함수들은 기존 pgTAP behavior/concurrency test를 새 PostgreSQL에서 통과시킨 뒤에만
재설계를 검토한다.

### 7.3 NestJS로 이동하는 로직

- JWT 검증과 endpoint 인가
- DTO 검증과 업무 use case 선택
- 공개/보호 API 결정
- 조회용 RPC의 외부 계약
- 단순 CRUD와 query projection
- 정기 작업 orchestration
- 외부 Storage/GitHub 등과의 통합
- 표준 오류와 관측성

`get_doc_rank`, `get_user_monthly_rank`, `get_words_by_theme`, random word와
advanced search 같은 조회 함수는 외부 RPC 이름으로 노출하지 않고 NestJS query
API 뒤에 둔다. 내부에서는 SQL, view 또는 private function 중 가장 명확한 구현을
사용할 수 있다.

### 7.4 pure Hangul 함수

`combine_hangul`, `decompose_hangul`, `duem`, `revers_duem`, `get_chosungs`,
`get_mission_mark`은 다음 기준을 사용한다.

- 대량 SQL 필터·projection 내부에서 필요하면 PostgreSQL 함수 유지
- 요청 입력 하나의 정규화만 필요하면 TypeScript domain 함수 사용
- 두 구현이 공존하면 동일 corpus를 사용하는 contract test로 일치 검증

### 7.5 trigger

초기 이식에서 유지할 trigger/function 영역:

- word first/last letter 통계
- words total count
- docs reference code 불변성
- word 변경에 따른 docs projection
- 기존 batch/command가 기대하는 로그와 contribution side effect

장기적으로 NestJS/outbox로 이동할 후보:

- 범용 last_update 갱신
- UI용 활동 로그
- cache invalidation 신호
- 외부 시스템 side effect

첫 word-domain cutover에서 trigger 재설계까지 동시에 수행하지 않는다. 통계와 파생
projection은 전체 재계산 SQL을 별도로 제공해 복구 가능하게 만든다.

## 8. Supabase auth.uid() 호환

기존 대형 RPC를 최소 변경으로 이식하기 위해 transaction-local actor helper를 둔다.

```sql
CREATE OR REPLACE FUNCTION private.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid;
$$;
```

관리자 command의 이중 방어가 필요하면 local users role을 검사하는
`private.assert_actor_role(allowed_roles)`을 둔다.

보안 조건:

- actor ID는 요청 body에서 받지 않는다.
- 검증된 JWT subject만 NestJS가 설정한다.
- actor-dependent 함수는 transaction 안에서만 호출한다.
- `SECURITY DEFINER` 함수는 고정 `search_path`를 사용한다.
- PUBLIC execute를 revoke하고 runtime DB role에만 grant한다.
- 새 함수는 가능하면 actor를 명시적 인자로 받는다.

## 9. RLS와 PostgreSQL role

NestJS가 유일한 DB client가 되므로 Supabase의 anon/authenticated/service_role RLS를
그대로 복제하지 않는다.

| DB role | 용도 |
| --- | --- |
| kkuko_migrator | DDL과 migration |
| kkuko_api | NestJS runtime |
| kkuko_readonly | 제한된 운영 조회 |
| kkuko_job | 정기 작업이 생긴 경우 |

- 공개/보호 여부와 role은 NestJS가 판정한다.
- 소유권 조건은 repository SQL의 `WHERE owner_id = verifiedActorId`로도 방어한다.
- 구조적 무결성과 상태 전이는 DB가 최종 방어한다.
- 피해 범위가 큰 관리자 함수는 DB에서도 role을 재검사한다.
- runtime role에는 DDL과 임의 role 전환 권한을 주지 않는다.
- 다중 DB client가 실제로 생긴 경우에만 RLS 재도입을 검토한다.

## 10. 보조 테이블과 함수

기능이 실제로 필요해지는 단계에만 추가한다.

### 10.1 API idempotency

notification 생성처럼 외부 재시도가 가능한 command에 사용한다. 동일 actor,
operation, key를 unique하게 하고 request hash와 완료 응답을 저장한다. 동일 key에
다른 payload가 오면 `IDEMPOTENCY_KEY_REUSED`를 반환한다. 기존 word batch의
operation ID/payload hash와 중복 적용하지 않는다.

### 10.2 Outbox

Storage 정리, cache invalidation, 외부 이벤트가 필요할 때 `outbox_events`를 둔다.
worker는 `FOR UPDATE SKIP LOCKED`로 경쟁 없이 처리하고 attempts, available_at,
last_error와 processed_at을 기록한다.

### 10.3 Audit

관리자 공지 변경, role 변경, 단어 대량 승인·삭제, moderation과 export를 감사한다.
일반 로그에 access token, 본문 전체 또는 batch payload 전체를 남기지 않는다.
감사 데이터는 필요한 변경 필드와 hash를 우선하고 접근 권한과 보존 기간을 별도로
관리한다.

### 10.4 Scheduled job lock

월 기여도 초기화, projection 재생성, 고아 Storage 정리는 NestJS scheduler 또는
별도 worker가 담당한다. 여러 instance에서 중복 실행되지 않도록 PostgreSQL advisory
lock 또는 job lease를 사용한다.

## 11. 단계별 마이그레이션

### Phase 0: 공통 기반과 baseline

- cloud schema, local migration result, 생성 타입, production 사용처 diff
- NestJS auth/database/error/logging/health 기반
- DB role과 connection pool
- migration CI와 실제 PostgreSQL test 환경
- backup/restore 리허설
- staging Next.js → NestJS 통신 검증

### Phase 1: notification

- NestJS notification module과 API
- 프런트 HTTP gateway
- `supabase`, `shadow`, `nest` slice flag
- 관리자 쓰기 중지 후 snapshot/import/sequence 보정
- row count, ID, null, checksum, views, modal, image URL 검증
- shadow read 후 한 번의 source 전환
- smoke/concurrency test와 안정화
- 안정화 후 notification DB Supabase gateway 제거
- Storage와 Auth adapter는 유지

notification에는 updated_at이 없으므로 장기간 delta copy에 의존하지 않는다. 짧은
쓰기 중지 후 최종 snapshot과 검증을 사용한다. cutover 후 신규 DB에 write가 발생한
뒤에는 단순 flag rollback이 안전하지 않으므로 쓰기 잠금, 역복사, 검증이 포함된
runbook을 사용한다.

### Phase 2: programs와 release-note

- 독립적인 read API로 각각 이전
- GitHub release gateway 이전과 DB 이전은 분리
- source precedence와 정렬 contract 보존

### Phase 3: identity projection

- Supabase Auth UUID를 그대로 사용하는 local users projection
- 초기 snapshot과 주기적 reconciliation
- nickname과 role/contribution diff 탐지
- 이 단계의 authoritative source는 여전히 Supabase public.users
- 권한 확인도 아직 Supabase adapter 사용

users에 updated_at이 없으므로 규모가 작으면 full reconciliation을 사용하고, 커지면
updated_at, change outbox 또는 CDC를 도입한다.

### Phase 4: word-catalog read model

- words, themes, word_themes, 통계·카운트와 필요한 pending projection 복제
- Supabase를 write source로 유지한 단방향 CDC/delta sync
- 검색, 상세, 다운로드, 통계, 조합기와 docs별 word 결과 shadow 비교
- update/delete를 놓치는 `id > lastId` 방식 금지

CDC 사용 가능 여부는 실제 Supabase 플랜, 권한, 네트워크와 신규 PostgreSQL 배포
환경에서 사전 검증한다. 불가능하면 change log trigger 또는 maintenance snapshot
cutover를 사용한다.

### Phase 5: docs read API

- 목록, 상세, contents, logs, marker, favorite, rank와 request read
- reference code, long-word, mission, parent/child last update 검증
- command source가 Supabase인 동안 신규 DB는 projection

### Phase 6: word request/moderation command cutover

같이 source를 전환할 대상:

- users contribution/role
- words/themes/word_themes
- wait_words/wait_word_themes/word_themes_wait
- logs
- docs/docs_logs/docs_wait/user_star_docs
- word 통계·카운트
- approval/deletion operation과 batch
- 관련 함수·트리거

cutover는 command maintenance, CDC lag 0, 최종 change replay, FK/checksum/projection
검증 후 수행한다. 승인·삭제·취소 경쟁, exact-once contribution, role 승격, 통계,
docs log, 재개 가능한 batch를 실제 concurrency test로 검증한다.

이 단계 후 local users가 authoritative가 되고 role reader를 PostgreSQL로 전환한다.
Supabase는 JWT identity provider로만 남는다.

### Phase 7: 나머지 소비자

- 관리자 dashboard/users/logs
- word logs
- profile summary/search/request/favorite
- nickname 등록·변경
- admin API token 소비자

완료 시 production source의 Supabase DB `.from()`과 `.rpc()` 호출이 0이어야 한다.
Auth와 Storage 호출은 별도로 측정한다.

### Phase 8: Supabase Database 종료

- 신규 PostgreSQL restore 훈련과 PITR
- migration/function/extension/job inventory
- Supabase DB 호출 metric 0
- rollback 보존 기간 경과
- 최종 archive dump

Auth와 Storage가 같은 Supabase project의 내부 metadata DB에 의존할 수 있으므로
application DB 호출 제거와 Supabase project DB 자체 제거를 동일한 작업으로 취급하지
않는다.

### Phase 9: Storage 제거

확인된 최소 대상:

- `public_img/notifications/*`
- `public_img/txt/eng_len_6_words.txt`

신규 object storage에 object를 복사하고 checksum/content type을 검증한다. 장기적으로
provider URL 전체 대신 `notifications/<uuid>.png` 같은 object key를 DB에 저장한다.
presigned upload 또는 NestJS streaming upload를 사용하고, cleanup job/outbox로
고아 객체를 정리한다.

### Phase 10: Auth 제거

- Google OAuth/OIDC와 authorization code + PKCE
- session/token rotation과 revocation
- CSRF, callback allowlist, rate limit
- key rotation과 JWKS/verification
- 기존 Supabase UUID와 신규 provider subject 매핑

기존 서비스 FK의 user UUID를 바꾸지 않고 별도 user_identities에서 provider subject를
연결한다. 전환 후 Supabase SSR/JS clients, middleware session refresh, OAuth callback,
Auth gateway와 환경변수를 제거한다.

## 12. Cutover와 rollback 원칙

공통 순서:

```text
expand schema
→ backfill/sync
→ 검증
→ shadow read
→ write maintenance
→ 최종 delta
→ source switch
→ smoke/concurrency test
→ 관찰
→ 기존 adapter 제거
→ contract cleanup
```

- 읽기와 쓰기 backend flag를 운영자가 위험하게 교차 설정하지 못하게 한다.
- shadow 오류가 사용자 응답을 실패시키지 않는다.
- random 결과는 동일 행이 아니라 조건과 유효성을 비교한다.
- 신규 source에 write가 발생한 뒤의 rollback은 역복사와 검증 없이 실행하지 않는다.
- DB schema rollback보다 backward-compatible deploy와 forward fix를 우선한다.
- Storage 정리 실패는 DB rollback 사유가 아니다.

## 13. 오류 계약

```json
{
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "공지사항을 찾을 수 없습니다",
    "details": null,
    "requestId": "01J..."
  }
}
```

SQLSTATE는 constraint name allowlist로 업무 오류에 매핑한다.

| SQLSTATE | 처리 |
| --- | --- |
| 23505 | constraint별 409 |
| 23503 | 업무 의미에 따라 409/422 |
| 23514 | 422 |
| 23P01 | exclusion conflict 409 |
| 40001 | 멱등 operation의 제한 재시도 |
| 40P01 | 제한 재시도 후 503 |
| 42501 | 403 |
| 57014 | 503 |

외부 응답에 stack, SQL, 테이블명과 내부 constraint 구조를 노출하지 않는다.

## 14. 테스트

### 14.1 NestJS unit

- DTO/application 변환
- role 정책
- 날짜 정책과 Clock
- bigint safe 변환
- error mapper
- Supabase identity response parsing
- token 로그 마스킹

### 14.2 PostgreSQL integration

- 빈 DB migration과 upgrade
- 기본값·constraint·index 의미
- notification 목록/상세/active modal
- 동시 조회 수 증가
- modal exclusion
- image CAS와 reference count
- sequence 보정

### 14.3 기존 pgTAP 자산

word approval/deletion, request moderation, docs request, direct word mutation, user
request, favorite/reference, 통계와 notification view 테스트를 독립 PostgreSQL runner로
이식한다. Supabase CLI 결합만 제거하고 assertion 의미는 유지한다.

### 14.4 concurrency

- 동일 modal 기간 동시 생성
- 조회 수 N회 증가
- 동일 batch exact-once
- 승인/삭제와 취소/승인 경쟁
- 동일 idempotency key
- outbox `SKIP LOCKED`
- actor context pool 누출 없음

### 14.5 API와 프런트 contract

- OpenAPI request/response
- status/error code
- unknown field, body size와 CORS
- 인증 matrix
- 프런트 HTTP gateway의 ApplicationError 변환
- malformed JSON, timeout, AbortSignal과 네트워크 오류
- 기존 UI/application test 유지

## 15. 관측성과 보안

구조화 로그 필드:

- timestamp, level, service, environment
- requestId, method, route template, status, duration
- actorId, errorCode, databaseOperation

로그 금지:

- Authorization header와 token
- Supabase service key와 DB URL/password
- OAuth code
- 전체 공지 본문
- 전체 word batch payload
- 파일 원문

필수 metric:

- endpoint별 요청·오류·latency
- DB pool active/idle/waiting과 query duration
- timeout/deadlock/retry
- Supabase identity latency/error
- shadow mismatch와 CDC lag
- outbox backlog와 Storage cleanup 실패
- notification conflict

보안 기준:

- HTTPS, 정확한 CORS allowlist와 Helmet
- body/rate 제한과 unknown field 거부
- service key는 NestJS secret store에만 저장
- Supabase adapter timeout/circuit breaker
- PostgreSQL 외부 직접 노출 금지와 TLS
- migrator/runtime credential 분리
- public schema create 권한 revoke
- parameterized query
- `SECURITY DEFINER` search_path 고정과 PUBLIC execute revoke

## 16. Migration, backup과 복구

migration은 각 API replica 시작 시 자동 실행하지 않고 배포 pipeline의 단일 job으로
실행한다.

```text
backup/precheck
→ 단일 migration job
→ schema verification
→ backward-compatible API deploy
→ smoke test
→ feature flag switch
```

원칙:

- expand → migrate → switch → contract
- 사용 중인 컬럼을 같은 배포에서 삭제/rename하지 않는다.
- migration 파일은 수정하지 않고 새 migration으로 보정한다.
- 대형 index와 table rewrite의 lock 시간을 사전 측정한다.
- down migration만 믿지 않고 forward fix와 restore 절차를 준비한다.

운영 필수 항목:

- 자동 base backup과 WAL/PITR
- 암호화와 별도 장애 영역 복사본
- 보존 기간과 RPO/RTO
- 정기 restore test
- migration 전 restore point
- DB/Storage 시점 불일치 reconciliation

## 17. 완료 기준

각 슬라이스는 다음 조건을 모두 만족해야 완료된다.

- NestJS unit/integration/e2e와 concurrency test 통과
- 프런트 gateway 및 기존 feature test 통과
- shadow comparison 허용 범위 내
- 인증·인가 negative test 통과
- migration/cutover/rollback runbook 존재
- dashboard와 alert 준비
- 해당 기능의 Supabase DB 호출 0
- 안정화 기간 경과
- 기존 Supabase DB gateway 제거
- 사용하지 않는 policy/function 정리
- 환경변수와 운영 문서 갱신

전체 Database 이전 완료 기준:

- production source의 Supabase DB `.from()`과 `.rpc()` 0
- Supabase service key의 Database 용도 0
- 신규 PostgreSQL backup/restore 검증
- 모든 scheduled job과 DB function inventory 이전
- local users가 role/contribution source of truth

Storage와 Auth 제거는 각각 별도의 완료 기준과 구현 계획을 가진다.

## 18. 현재 DB 함수·트리거 이관 인벤토리

이 목록은 저장소의 remote schema, 후속 migration, 생성 타입과 production 호출을
기준으로 작성한 이관 체크리스트다. Phase 0에서 cloud dump와 대조해 최종 확정한다.

### 18.1 외부 command RPC

초기에는 transaction 함수로 이식하고 NestJS command API 뒤에 둔다.

- `add_word_directly`
- `apply_word_approval_batch`
- `apply_word_deletion_batch`
- `approve_docs_requests`
- `approve_word_requests`
- `cancel_word_approval_operation`
- `cancel_word_deletion_operation`
- `cancel_word_request`
- `delete_word_directly`
- `delete_word_themes_bulk`
- `delete_word_themes_wait_bulk`
- `increment_contribution`
- `increment_doc_views`
- `increment_notification_views`
- `reject_docs_requests`
- `reject_word_requests`
- `request_word_addition`
- `request_word_additions`
- `request_word_deletion`
- `request_word_theme_changes`
- `set_docs_favorite`
- `start_word_approval_operation`
- `start_word_deletion_operation`
- `update_last_update`
- `update_last_updates`

`increment_notification_views`는 NestJS repository의 원자 UPDATE로 대체한다.
`increment_doc_views`와 contribution 증감도 단순 원자 SQL로 충분한지 해당 slice에서
판단한다. 복합 command는 먼저 함수로 보존한다.

### 18.2 operation/query RPC

외부 API에는 DB 함수 이름을 노출하지 않고 query repository 또는 private function으로
사용한다.

- `get_word_approval_operation`
- `get_word_deletion_operation`
- `get_delete_requests_by_themeid`
- `get_doc_rank`
- `get_long_wait_words_data`
- `get_user_monthly_rank`
- `get_words_by_theme`
- `get_words_with_themes`
- `get_korean_words_advanced_e`
- `get_korean_words_advanced_hunmin`
- `get_korean_words_advanced_jaqi`
- `get_korean_words_advanced_kung`
- `get_korean_words_advanced_s`
- `get_mission_len3_words`
- `get_mission_words`
- `random_wait_word_ff`
- `random_wait_word_ll`
- `random_word_ff`
- `random_word_ll`
- production 호출에서 발견된 `search_words`

`search_words`는 생성 타입과 migration 기준선에서 불일치가 있으므로 cloud signature와
호출 payload를 Phase 0에서 확정한다.

### 18.3 pure/계산 함수

- `combine_hangul`
- `decompose_hangul`
- `duem`
- `revers_duem`
- `get_chosungs`
- `get_mission_mark`
- `increase_word_stats`
- `decrease_word_stats`
- `show_limit`, `show_trgm` 등 extension 노출 함수

extension 소유 함수는 application migration 대상으로 복사하지 않는다. 필요한
extension을 명시적으로 설치하면 PostgreSQL이 제공하는 객체와 application 소유 객체를
분리해서 관리한다.

### 18.4 유지 또는 재배치할 scheduled/maintenance 함수

- `insert_mission_words`
- `reset_monthly_contribution`
- word 통계 전체 재계산 함수 또는 운영 SQL
- docs reference/projection 재계산 함수 또는 운영 SQL

스케줄 시작은 NestJS worker가 담당하고, 실제 대량 갱신은 하나의 transaction 함수나
검증 가능한 SQL script로 실행할 수 있다.

### 18.5 trigger 함수와 trigger

확인된 주요 trigger 함수:

- `fn_process_word_docs_update`
- `log_last_update_trigger`
- `sync_parent_last_update`
- `tg_word_stats_changes`
- `trg_dec_first_letter_count`
- `trg_dec_last_letter_count`
- `trg_inc_first_letter_count`
- `trg_inc_last_letter_count`
- `update_docs_last_update`
- `update_docs_last_update_if_letter_match`
- `update_last_modified`
- `update_user_role_with_update`
- `update_word_letter_counts`
- `update_words_count`
- `words_docs_logs_trg`
- `private.enforce_docs_reference_code_immutable`

확인된 주요 trigger 연결:

- `trg_after_word_change` → word/docs projection
- `trg_sync_parent_last_update` → parent docs 갱신
- `trg_update_docs_from_wait_words` → pending word에 따른 docs 갱신
- `trg_update_docs_from_words` → word에 따른 docs 갱신
- `trg_words_docs_logs` → docs log 기록
- themes/docs_logs/wait_word_themes/wait_words/word_themes/words의
  `trigger_*_last_modified` → last-update projection
- `trigger_update_user_role_with_update` → contribution 기반 role 갱신
- `update_word_stats_trigger` → first/last letter 통계
- `words_after_insert` → 전체 단어 수
- `trg_docs_reference_code_immutable` → reference code 불변성

과거 trigger가 후속 migration에서 `CREATE OR REPLACE FUNCTION`으로 의미가 바뀐 경우
최종 migration 적용 결과의 함수 body를 기준으로 이식한다. remote schema dump의 초기
body를 그대로 복사하지 않는다.

### 18.6 private helper

저장소 migration에서 확인된 private helper 범주:

- 관리자 actor 확인
- request moderation safe-integer 검증
- word deletion operation 결과 구성
- docs reference code 해석과 필수 reference 확인
- docs reference code 불변성

Supabase `auth.uid()`를 사용하는 actor helper는 `private.current_actor_id()`와 local
role 검사로 교체한다. JSON safe-integer 검증은 HTTP DTO와 DB 함수 양쪽에서 유지해
JavaScript number와 PostgreSQL bigint 경계를 보호한다.

## 19. 구현 계획 분할

이 설계는 여러 독립 하위 프로젝트를 포함하므로 하나의 구현 계획으로 만들지 않는다.
각 계획은 독립적으로 배포하고 검증 가능한 결과를 만들어야 한다.

권장 계획 순서:

1. NestJS PostgreSQL/API 공통 기반
2. notification backend와 schema
3. kkuko-utils notification HTTP gateway와 cutover
4. programs/release-note 이전
5. identity projection
6. word-catalog read replication/API
7. docs read API
8. word command/RPC/trigger 이전과 source cutover
9. 나머지 소비자와 Supabase Database 종료
10. Storage 이전
11. Auth 이전

NestJS 저장소와 `kkuko-utils` 저장소의 파일 경로·CI·배포 환경이 다르므로 구현 계획도
저장소별 책임을 명시한다. 첫 실행 계획은 공통 기반, notification backend,
notification frontend adapter의 세 문서로 나누는 것을 권장한다.
