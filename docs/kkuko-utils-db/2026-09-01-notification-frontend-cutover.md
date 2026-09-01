# Kkuko Utils Notification HTTP Gateway and Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 `kkuko-utils`의 notification application/UI를 유지하면서 Supabase DB gateway를 NestJS HTTP gateway로 교체하고, shadow 검증·데이터 이관·안전한 cutover를 수행한다.

**Architecture:** 기존 application port의 HTTP 구현을 추가한다. 공개 RSC/browser query는 실행 위치를 유지하고, 관리 Server Action은 server Supabase session의 access token을 NestJS에 전달한다. 하나의 slice flag가 `supabase`, `shadow`, `nest` 상태를 제어하며 Storage adapter는 Supabase 구현을 유지한다.

**Tech Stack:** Next.js 15, TypeScript, React Query, Jest, Testing Library, native fetch

**Spec:** `../superpowers/specs/2026-09-01-pg-api-strangler-migration-design.md`

## Global Constraints

- 이 계획의 파일 경로는 현재 `kkuko-utils` 저장소 기준이다.
- backend foundation과 notification API 계획 완료가 선행 조건이다.
- UI, application port와 Storage 보상 순서를 불필요하게 바꾸지 않는다.
- 브라우저에는 service key와 private API URL을 노출하지 않는다.
- NestJS가 보호 command의 최종 JWT/role 검사를 수행한다.
- Access token, notification body와 image binary를 log에 남기지 않는다.
- Backend read/write를 서로 다른 source로 설정할 수 있는 flag 조합을 만들지 않는다.
- Supabase notification gateway는 안정화 기간 종료 전 제거하지 않는다.

---

## File Map

- `src/shared/infrastructure/http/*`: fetch client, error parser, base URL
- `src/modules/notifications/infrastructure/http/*`: notification port 구현
- `src/modules/notifications/infrastructure/server/*`: server HTTP composition과 token provider
- `src/modules/notifications/infrastructure/browser/*`: modal HTTP composition
- `src/modules/notifications/infrastructure/shadow/*`: 비차단 read comparison
- `src/app/notification/actions.ts`: 기존 action과 새 composition 연결
- `docs/deployment/notification-db-cutover.md`: 운영 runbook
- `src/__tests__/modules/notifications/infrastructure/http/*`: gateway contract

## Task 1: HTTP Configuration and Stable Client

**Files:**
- Create: `src/shared/infrastructure/http/api-client.ts`
- Create: `src/shared/infrastructure/http/api-error.ts`
- Create: `src/shared/infrastructure/http/api-config.ts`
- Test: `src/__tests__/shared/infrastructure/http/api-client.test.ts`
- Modify: `env.d.ts`

**Interfaces:**
- Produces: `requestApi<T>(request: ApiRequest): Promise<Result<T>>`

```ts
export type NotificationBackend = 'supabase' | 'shadow' | 'nest';
export interface ApiRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  cache?: RequestCache;
}
```

- [ ] **Step 1: HTTP/error contract tests를 작성한다**

Test 2xx JSON, empty/malformed JSON, 401/403/404/409/422/503, timeout/abort, network error, unknown API code and request ID preservation.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/shared/infrastructure/http/api-client.test.ts`

- [ ] **Step 3: config/client를 구현한다**

- Server URL: `KKUKO_DB_API_URL`
- Browser URL: `NEXT_PUBLIC_KKUKO_DB_API_URL`
- Slice flag: `NEXT_PUBLIC_NOTIFICATION_DATA_BACKEND`
- URL parser는 HTTP(S), origin과 trailing slash를 정규화한다.
- fetch는 `Content-Type: application/json`, optional Bearer token과 AbortSignal을 사용한다.
- 오류 body가 malformed이면 기존 `infrastructure` ApplicationError로 변환한다.

- [ ] **Step 4: env type을 추가한다**

```ts
KKUKO_DB_API_URL: string;
NEXT_PUBLIC_KKUKO_DB_API_URL: string;
NEXT_PUBLIC_NOTIFICATION_DATA_BACKEND: 'supabase' | 'shadow' | 'nest';
```

- [ ] **Step 5: test/typecheck 후 커밋한다**

```bash
npx jest src/__tests__/shared/infrastructure/http/api-client.test.ts
npx tsc --noEmit
git add src/shared/infrastructure/http src/__tests__/shared/infrastructure/http env.d.ts
git commit -m "feat: add database api client"
```

## Task 2: Public Notification HTTP Query Gateways

**Files:**
- Create: `src/modules/notifications/infrastructure/http/http-notification-list-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/http/http-notification-detail-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/http/http-modal-notice-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/http/http-notification-view-command-gateway.ts`
- Test: matching files under `src/__tests__/modules/notifications/infrastructure/http/`

**Interfaces:**
- Implements existing `NotificationListQueryGateway`, `NotificationDetailQueryGateway`, `ModalNoticeQueryGateway`, `NotificationViewCommandGateway`

- [ ] **Step 1: exact response parsing tests를 작성한다**

Each gateway must reject missing fields, unsafe IDs/views, invalid ISO dates, wrong nullability and unknown envelope shape. Confirm active modal null and view 404 mapping.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/http`

- [ ] **Step 3: gateway를 구현한다**

Endpoints:

```text
GET  /v1/notifications
GET  /v1/notifications/:id
GET  /v1/notifications/active-modal
POST /v1/notifications/:id/views
```

Do not cast API JSON directly to application types; narrow every field from `unknown`.

- [ ] **Step 4: test/typecheck 후 커밋한다**

```bash
npx jest src/__tests__/modules/notifications/infrastructure/http
npx tsc --noEmit
git add src/modules/notifications/infrastructure/http src/__tests__/modules/notifications/infrastructure/http
git commit -m "feat: query notifications through api"
```

## Task 3: Authenticated Command and Image Reference Gateways

**Files:**
- Create: `src/modules/notifications/infrastructure/http/http-notification-write-command-gateway.ts`
- Create: `src/modules/notifications/infrastructure/http/http-notification-delete-command-gateway.ts`
- Create: `src/modules/notifications/infrastructure/http/http-notification-image-reference-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/server/supabase-server-access-token-provider.ts`
- Test: matching `*.test.ts`

**Interfaces:**
- Implements existing write/delete/image-reference ports
- Produces: `ServerAccessTokenProvider.getAccessToken(): Promise<Result<string>>`

- [ ] **Step 1: command/token tests를 작성한다**

Test create/update payload mapping, null expected image, delete response, reference boolean, 409 codes, missing session, malformed session and absence of token in thrown/logged errors.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/http src/__tests__/modules/notifications/infrastructure/server/supabase-server-access-token-provider.test.ts`

- [ ] **Step 3: token provider를 구현한다**

Use the request-scoped server Supabase client `auth.getSession()`. Return only non-empty `session.access_token`; do not accept userId/role from callers.

- [ ] **Step 4: HTTP command gateways를 구현한다**

```text
POST   /v1/notifications
PATCH  /v1/notifications/:id
DELETE /v1/notifications/:id
POST   /v1/notifications/image-reference-checks
```

Every request carries `Authorization: Bearer <token>`. Map `NOTIFICATION_MODAL_OVERLAP` and `NOTIFICATION_STALE_IMAGE` to existing conflict codes.

- [ ] **Step 5: test/typecheck 후 커밋한다**

```bash
npx jest src/__tests__/modules/notifications/infrastructure/http src/__tests__/modules/notifications/infrastructure/server
npx tsc --noEmit
git add src/modules/notifications/infrastructure src/__tests__/modules/notifications/infrastructure
git commit -m "feat: mutate notifications through api"
```

## Task 4: Backend Selection and Shadow Comparison

**Files:**
- Create: `src/modules/notifications/infrastructure/shadow/shadow-notification-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/shadow/notification-comparator.ts`
- Modify: `src/modules/notifications/infrastructure/server/server-notification-services.ts`
- Modify: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- Test: corresponding server/browser/shadow tests

**Interfaces:**
- Produces one composition selected by `supabase | shadow | nest`

- [ ] **Step 1: selection/shadow tests를 작성한다**

Assertions:

- `supabase`: only Supabase called
- `nest`: only HTTP called
- `shadow`: Supabase result returned immediately; HTTP comparison failure does not change result
- mismatch event contains query name/request ID/hash, not body/token
- command composition never dual-writes

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/shadow src/__tests__/modules/notifications/infrastructure/server/server-notification-services.test.ts`

- [ ] **Step 3: comparator와 selection을 구현한다**

- Compare canonical list order and exact projection fields.
- Normalize timestamps before hash comparison.
- Browser shadow request is fire-and-observe with caught rejection.
- Server shadow may await comparison only outside user critical path; it must return source result regardless.
- Command backend is `supabase` unless flag is exactly `nest`; `shadow` does not execute Nest command.

- [ ] **Step 4: test/typecheck 후 커밋한다**

```bash
npx jest src/__tests__/modules/notifications/infrastructure
npx tsc --noEmit
git add src/modules/notifications/infrastructure src/__tests__/modules/notifications/infrastructure
git commit -m "feat: select notification backend"
```

## Task 5: Server Actions and Cache Integration

**Files:**
- Modify: `src/modules/notifications/infrastructure/server/server-notification-command-services.ts`
- Modify: `src/app/notification/actions.ts`
- Modify: `src/modules/notifications/infrastructure/server/server-notification-services.ts`
- Test: existing notification action/service tests

**Interfaces:**
- Preserves: `recordNotificationViewAction`, `saveNotificationAction`, `deleteNotificationAction`

- [ ] **Step 1: action compatibility tests를 확장한다**

Test access-token failure, Nest 401/403/409/503 mapping, successful revalidation and no revalidation on failure. Confirm Supabase Storage upload/cleanup order remains unchanged.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/notification/actions.test.ts src/__tests__/modules/notifications/infrastructure/server`

- [ ] **Step 3: composition을 교체한다**

- `nest` command factory gets access token, constructs HTTP DB gateways, and keeps `SupabaseNotificationImageStorage`.
- Existing `SaveNotificationService` and `DeleteNotificationService` still orchestrate Storage compensation/reference checks.
- Existing `revalidatePath` behavior is preserved.

- [ ] **Step 4: 관련 전체 test를 실행하고 커밋한다**

```bash
npx jest src/__tests__/notification src/__tests__/modules/notifications
npx tsc --noEmit
git add src/app/notification/actions.ts src/modules/notifications/infrastructure/server src/__tests__
git commit -m "feat: route notification actions to api"
```

## Task 6: Source-Boundary Regression Tests

**Files:**
- Create: `src/__tests__/modules/notifications/notification-api-boundary.test.ts`
- Modify: `scripts/verify-ddd-lite-architecture.mjs`

**Interfaces:**
- Produces architecture guard for post-cutover removal

- [ ] **Step 1: failing boundary test를 작성한다**

The test inspects production AST/files and reports notification code that imports Supabase DB gateways outside the fallback composition. It separately permits Auth and Storage adapters.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest src/__tests__/modules/notifications/notification-api-boundary.test.ts`

- [ ] **Step 3: architecture verifier를 확장한다**

Classify dependencies as `database`, `auth`, or `storage`; do not use raw text counts that mistake comments/tests for runtime calls.

- [ ] **Step 4: 검증하고 커밋한다**

```bash
npm run verify:architecture
npx jest src/__tests__/modules/notifications/notification-api-boundary.test.ts
git add scripts/verify-ddd-lite-architecture.mjs src/__tests__/modules/notifications/notification-api-boundary.test.ts
git commit -m "test: guard notification api boundary"
```

## Task 7: Cutover Runbook and Production Gate

**Files:**
- Create: `docs/deployment/notification-db-cutover.md`
- Create: `docs/deployment/notification-db-rollback.md`
- Modify: `docs/README.md`

**Interfaces:**
- Produces operator checklist with exact commands/environment transitions

- [ ] **Step 1: runbook test/checklist를 먼저 작성한다**

Runbook must contain explicit sections for precheck, shadow, maintenance, export/import, verification, flag switch, smoke test, monitoring, rollback and cleanup. Add a documentation test or `rg` command that asserts every heading exists.

- [ ] **Step 2: cutover runbook을 작성한다**

Required sequence:

```text
1. Verify backend migration, health and backup
2. Set frontend to shadow and observe zero unexplained mismatch
3. Disable notification create/update/delete UI
4. Export Supabase notification to NDJSON including views
5. Import to PostgreSQL and set sequence
6. Run source/target verifier; stop on any mismatch
7. Set backend to nest in staging/production configuration
8. Smoke public list/detail/modal/views
9. Smoke admin/r4 create/update/delete and modal conflict
10. Re-enable writes
11. Observe 5xx, auth, DB pool, mismatch and Storage cleanup metrics
```

- [ ] **Step 3: rollback runbook을 작성한다**

Distinguish pre-write flag rollback from post-write controlled reverse copy. Post-write rollback always begins by disabling writes; it never switches reads to stale Supabase data before reverse verification.

- [ ] **Step 4: repository verification을 실행한다**

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run verify:architecture
npm run build
git diff --check
```

Expected: all PASS. If full test/build failure is pre-existing, record exact command and failure without changing unrelated tests.

- [ ] **Step 5: 문서를 커밋한다**

```bash
git add docs/deployment docs/README.md
git commit -m "docs: add notification database cutover runbook"
```

## Stabilization and Cleanup Gate

Do not remove fallback in the same deployment as cutover.

- [ ] Agreed stabilization period passes with acceptable error/latency.
- [ ] Supabase notification DB calls are 0 in production telemetry.
- [ ] NestJS is the only notification DB writer.
- [ ] Backup/restore and post-write rollback drill are documented.
- [ ] Remove Supabase notification list/detail/modal/view/write/delete/reference DB gateways.
- [ ] Keep Supabase Auth, server access-token provider and image Storage gateway.
- [ ] Remove `shadow` mode and reduce backend flag to `nest` before deleting the flag entirely.
- [ ] Run lint, typecheck, notification tests, full tests, architecture verification and build.
- [ ] Commit cleanup as `refactor: remove notification supabase database access`.
