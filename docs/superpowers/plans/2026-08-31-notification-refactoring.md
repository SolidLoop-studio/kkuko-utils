# Notification Server Action, ISR, and View Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공지 상세 방문마다 조회수를 원자적으로 기록하고, 공개 본문을 60초 ISR로 제공하며, 공지 생성·수정·삭제와 이미지 처리를 인증된 Server Action으로 이동한다.

**Architecture:** 공개 목록·상세 조회는 쿠키 없는 anon Supabase client와 `unstable_cache`를 사용하고, 편집 조회와 쓰기는 사용자 세션이 포함된 server client를 사용한다. 조회수는 본문 cache와 분리된 공개 Server Action/RPC로 증가시키며, 관리자 action은 기존 Application service와 환경 중립 Supabase adapter를 재사용한 뒤 성공한 경로만 `revalidatePath`로 무효화한다.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, Supabase/PostgreSQL, React Query 5, Jest/Testing Library, pgTAP

**Spec:** `docs/superpowers/specs/2026-08-31-notification-refactoring-design.md`

## Global Constraints

- 조회수는 상세 화면이 정상 마운트될 때마다 한 번 증가하며 새로고침과 재방문도 새 조회로 센다.
- 조회수는 상세 화면의 작성일 옆에만 표시하고 목록·전역 Modal projection에는 추가하지 않는다.
- 공개 상세 cache lifetime은 정확히 60초이며 조회수 증가로 cache를 무효화하지 않는다.
- 저장·삭제 Server Action은 `getUser()`와 DB role을 확인하고 기존 RLS와 동일하게 `r4`와 `admin`을 허용한다. UI 노출은 기존처럼 `admin`만 허용한다.
- 이미지 파일은 최대 5MB이고 Server Action body limit은 `6mb`다. client의 `accept="image/*"`와 server의 `image/` MIME 검증을 함께 적용한다.
- 기존 `SaveNotificationService`, `DeleteNotificationService`, `Result<ApplicationError>`, 이미지 rollback·참조 확인·best-effort cleanup과 Modal UX를 보존한다.
- 서버 composition·public client 파일은 `server-only`로 표시하고 access token, 원본 PostgREST 오류와 이미지 내용을 로그 또는 client Result에 포함하지 않는다.
- `database.types.ts`는 직접 수정하지 않는다. 원격 schema 적용 후 `npm run gen-type` 결과만 반영한다.
- `alert`와 `confirm`을 사용하지 않는다.
- 현재 워크트리의 `src/app/words-docs/[id]/DocsDataHome.tsx`와 대응 테스트 변경은 사용자 작업이므로 수정·stage하지 않는다.

---

### Task 1: Atomic Notification View Schema

**Files:**
- Create: `supabase/migrations/20260831130000_refactor_notifications.sql`
- Create: `supabase/tests/database/notification-views.integration.sql`
- Modify: `package.json`

**Interfaces:**
- Produces: `public.notification.views bigint not null default 0`
- Produces: `public.increment_notification_views(p_notification_id bigint) returns bigint`
- Consumes: existing `public.notification(id bigint)` table and anon/authenticated Supabase roles

- [ ] **Step 1: Write the failing pgTAP test**

Create a transaction-scoped test that inserts a non-modal notice, verifies default zero, calls the RPC twice, checks `1` then `2`, checks a missing ID returns `null`, verifies the negative check constraint, and verifies execute privileges.

```sql
begin;
select plan(8);

create temporary table notification_view_fixture as
with inserted as (
  insert into public.notification (title, body, end_at)
  values ('조회수 테스트', '본문', now() + interval '1 day')
  returning id
)
select id from inserted;

select is(
  (select views from public.notification where id = (select id from notification_view_fixture)),
  0::bigint,
  'new notifications start at zero views'
);
select is(
  public.increment_notification_views((select id from notification_view_fixture)),
  1::bigint,
  'first view returns one'
);
select is(
  public.increment_notification_views((select id from notification_view_fixture)),
  2::bigint,
  'second view returns two'
);
select is(
  (select views from public.notification where id = (select id from notification_view_fixture)),
  2::bigint,
  'increments are persisted without lost updates'
);
select is(public.increment_notification_views(9223372036854775807), null::bigint, 'missing notice returns null');
select throws_ok(
  $$update public.notification
       set views = -1
     where id = (select id from notification_view_fixture)$$,
  '23514',
  null,
  'negative views are rejected'
);
select ok(has_function_privilege('anon', 'public.increment_notification_views(bigint)', 'EXECUTE'), 'anon can record views');
select ok(has_function_privilege('authenticated', 'public.increment_notification_views(bigint)', 'EXECUTE'), 'authenticated can record views');

select * from finish();
rollback;
```

- [ ] **Step 2: Add a DB test script and verify the test fails**

Add this script to `package.json`:

```json
"test:notification-db": "supabase test db --local supabase/tests/database/notification-views.integration.sql"
```

Run: `npm run test:notification-db`

Expected: FAIL because `notification.views` or `increment_notification_views(bigint)` does not exist.

- [ ] **Step 3: Implement the forward migration**

```sql
alter table public.notification
  add column views bigint not null default 0,
  add constraint notification_views_nonnegative check (views >= 0);

create or replace function public.increment_notification_views(p_notification_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_views bigint;
begin
  if p_notification_id is null or p_notification_id <= 0 then
    return null;
  end if;

  update public.notification
     set views = views + 1
   where id = p_notification_id
   returning views into v_views;

  return v_views;
end;
$$;

revoke all on function public.increment_notification_views(bigint) from public;
grant execute on function public.increment_notification_views(bigint) to anon, authenticated, service_role;
```

- [ ] **Step 4: Reset the local schema and run the DB test**

Run: `npm run verify:local-db`

Run: `npm run test:notification-db`

Expected: local schema verification succeeds and pgTAP reports `1..8` with all eight assertions passing.

- [ ] **Step 5: Commit the schema slice**

```bash
git add supabase/migrations/20260831130000_refactor_notifications.sql supabase/tests/database/notification-views.integration.sql package.json
git commit -m "feat(notifications): add atomic view counter"
```

### Task 2: View Count Application Boundary and Detail Projection

**Files:**
- Create: `src/modules/notifications/application/notification-view-command-ports.ts`
- Create: `src/modules/notifications/application/record-notification-view.ts`
- Create: `src/__tests__/modules/notifications/application/record-notification-view.test.ts`
- Modify: `src/modules/notifications/application/notification-detail-query-types.ts`
- Modify: `src/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.ts`
- Modify: `src/modules/notifications/index.ts`
- Modify: `src/__tests__/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.test.ts`
- Modify: `src/__tests__/modules/notifications/application/get-notification-detail.test.ts`
- Modify: `src/__tests__/modules/notifications/infrastructure/server/server-notification-services.test.ts`
- Modify: `src/__tests__/notification/id/edit/page.test.tsx`
- Modify: `src/__tests__/notification/id/NotificationDetail.test.tsx`
- Modify: `src/__tests__/notification/id/page.test.tsx`
- Modify: `src/__tests__/notification/NotificationWriteForm.test.tsx`

**Interfaces:**
- Produces: `NotificationViewCommandGateway.record(id: number): Promise<Result<number>>`
- Produces: `RecordNotificationViewService.record(id: number): Promise<Result<number>>`
- Produces: `NotificationDetailProjection.views: number`
- Consumes: `Result<T>` and `ApplicationError`

- [ ] **Step 1: Write failing Application service tests**

Cover successful delegation, zero/negative/non-integer/unsafe IDs, returned error preservation, and thrown gateway normalization.

```ts
const gateway = { record: jest.fn().mockResolvedValue(ok(41)) };
const service = new RecordNotificationViewService(gateway);

await expect(service.record(17)).resolves.toEqual(ok(41));
expect(gateway.record).toHaveBeenCalledWith(17);

await expect(service.record(0)).resolves.toEqual(err({
    kind: 'validation',
    message: '올바른 공지사항 ID가 필요합니다.',
}));
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `npx jest src/__tests__/modules/notifications/application/record-notification-view.test.ts --runInBand`

Expected: FAIL because the port and service modules do not exist.

- [ ] **Step 3: Implement the port and service**

```ts
export interface NotificationViewCommandGateway {
    record(id: number): Promise<Result<number>>;
}

export class RecordNotificationViewService {
    constructor(private readonly gateway: NotificationViewCommandGateway) {}

    async record(id: number): Promise<Result<number>> {
        if (!Number.isSafeInteger(id) || id <= 0) {
            return err({ kind: 'validation', message: '올바른 공지사항 ID가 필요합니다.' });
        }
        try {
            return await this.gateway.record(id);
        } catch {
            return err({ kind: 'infrastructure', message: '공지사항 조회 수 기록에 실패했습니다.' });
        }
    }
}
```

- [ ] **Step 4: Write failing detail gateway tests for `views`**

Change the expected select string to include `views`, add `views: 40` to the valid row, expect `projection.views === 40`, and add malformed cases for negative, fractional, unsafe and string values.

Expected select:

```ts
'id, title, body, img, created_at, end_at, is_important, is_modal, views'
```

- [ ] **Step 5: Run the focused Application and gateway tests**

Run: `npx jest src/__tests__/modules/notifications/application/record-notification-view.test.ts src/__tests__/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.test.ts --runInBand`

Expected: service tests pass and gateway tests fail because `views` is not selected or projected.

- [ ] **Step 6: Add `views` to the detail-only projection and update fixtures**

Add `views: number` to `NotificationDetailProjection`, validate it as a nonnegative safe integer in `parseProjection`, and include it in the returned object. Add an explicit `views` value to every detail projection fixture. Do not modify `NotificationListItem`, `ModalNotice`, or list select strings.

- [ ] **Step 7: Run all notification Application and detail gateway tests**

Run: `npx jest src/__tests__/modules/notifications/application src/__tests__/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 8: Commit the Application boundary**

```bash
git add src/modules/notifications/application src/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.ts src/modules/notifications/index.ts src/__tests__/modules/notifications/application src/__tests__/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.test.ts src/__tests__/notification src/__tests__/modules/notifications
git commit -m "feat(notifications): expose detail view counts"
```

Before committing, use `git diff --cached --name-only` and remove any unrelated `DocsDataHome` path from the index.

### Task 3: Public Supabase Reads and 60-Second ISR

**Files:**
- Create: `src/shared/infrastructure/supabase/public-client.ts`
- Modify: `src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts`
- Modify: `src/modules/notifications/infrastructure/server/server-notification-services.ts`
- Modify: `src/app/notification/page.tsx`
- Modify: `src/app/notification/[id]/edit/page.tsx`
- Modify: `src/__tests__/modules/notifications/infrastructure/server/server-notification-services.test.ts`
- Modify: `src/__tests__/notification/id/edit/page.test.tsx`

**Interfaces:**
- Produces: `createPublicSupabaseClient(): SupabaseClient<Database>` with anon key and no cookies
- Produces: `getServerNotificationDetail(id: number)` as request-memoized 60-second cached public read
- Produces: `getFreshServerNotificationDetail(id: number)` as uncached authenticated read
- Produces: `createPublicNotificationServices()` for list and public detail reads

- [ ] **Step 1: Write failing public-client tests**

Extend the shared client test to assert `createClient` receives the public URL, anon key, and non-persistent auth options, and never requests cookies.

```ts
expect(createClient).toHaveBeenCalledWith(
    'https://example.supabase.co',
    'anon-key',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
```

- [ ] **Step 2: Write failing cache-boundary tests**

Replace the current “reloads in the next request” expectation with these cases:

- metadata and page calls for ID 17 share one underlying query;
- a second mocked request for ID 17 reuses the same `unstable_cache` result;
- ID 18 creates a separate cache entry;
- `getFreshServerNotificationDetail(17)` creates a new cookie-based client on each call.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `npx jest src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts src/__tests__/modules/notifications/infrastructure/server/server-notification-services.test.ts --runInBand`

Expected: FAIL because the public client and fresh/cached loader split do not exist.

- [ ] **Step 4: Implement the public client and read compositions**

```ts
import 'server-only';

export const createPublicSupabaseClient = (): SupabaseClient<Database> =>
    createClient<Database>(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
```

In `server-notification-services.ts`, construct the public list/detail services from this client. Define one module-scope persistent loader and wrap it in React request memoization:

```ts
const getCachedNotificationDetail = unstable_cache(
    async (id: number) => {
        const services = createPublicNotificationServices();
        return services.notificationDetailQueryService.get(id);
    },
    ['notification-detail'],
    { revalidate: 60 },
);

export const getServerNotificationDetail = cache(getCachedNotificationDetail);

export const getFreshServerNotificationDetail = async (id: number) => {
    const services = await createAuthenticatedNotificationQueryServices();
    return services.notificationDetailQueryService.get(id);
};
```

- [ ] **Step 5: Route list and edit consumers to the correct read path**

Use public composition in `notification/page.tsx`. Keep detail page and metadata on `getServerNotificationDetail`. Change only the edit page to `getFreshServerNotificationDetail`.

- [ ] **Step 6: Run read-boundary and page tests**

Run: `npx jest src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts src/__tests__/modules/notifications/infrastructure/server src/__tests__/notification/id/page.test.tsx src/__tests__/notification/id/edit/page.test.tsx --runInBand`

Expected: PASS, including cross-request cache reuse and fresh edit reads.

- [ ] **Step 7: Run the architecture verifier and commit**

Run: `npm run verify:architecture`

Expected: `DDD-lite architecture verification passed.`

```bash
git add src/shared/infrastructure/supabase/public-client.ts src/__tests__/shared/infrastructure/supabase/supabase-clients.test.ts src/modules/notifications/infrastructure/server src/app/notification/page.tsx src/app/notification/[id]/edit/page.tsx src/__tests__/modules/notifications/infrastructure/server src/__tests__/notification/id/edit/page.test.tsx
git commit -m "feat(notifications): cache public detail reads"
```

### Task 4: Environment-Neutral Notification Mutation Adapters

**Files:**
- Create: `src/modules/notifications/infrastructure/supabase/supabase-notification-write-command-gateway.ts`
- Create: `src/modules/notifications/infrastructure/supabase/supabase-notification-delete-command-gateway.ts`
- Create: `src/modules/notifications/infrastructure/supabase/supabase-notification-image-reference-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/supabase/supabase-notification-image-storage.ts`
- Modify: `src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.ts` into a thin wrapper
- Modify: `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts` into a thin wrapper
- Modify: `src/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.ts` into a thin wrapper
- Modify: `src/modules/notifications/infrastructure/browser/supabase-notification-image-storage.ts` into a thin wrapper
- Move: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts` to `src/__tests__/modules/notifications/infrastructure/supabase/supabase-notification-write-command-gateway.test.ts`
- Move: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts` to `src/__tests__/modules/notifications/infrastructure/supabase/supabase-notification-delete-command-gateway.test.ts`
- Move: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts` to `src/__tests__/modules/notifications/infrastructure/supabase/supabase-notification-image-reference-query-gateway.test.ts`
- Move: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts` to `src/__tests__/modules/notifications/infrastructure/supabase/supabase-notification-image-storage.test.ts`

**Interfaces:**
- Produces: four Supabase adapters whose constructors require explicit query/storage clients
- Consumes: existing notification command ports and `NotificationImageFile`
- Preserves: modal-overlap mapping, stale-image guard, managed URL parsing, rollback and reference-count behavior

- [ ] **Step 1: Move the existing adapter tests to the shared Supabase boundary**

Update imports to the new `infrastructure/supabase/` paths. Add source-boundary assertions that none of the four shared files imports `browser-client`, `server-client`, `next/headers`, or `next/cache`.

```ts
expect(source).not.toMatch(/browser-client|server-client|next\/headers|next\/cache/u);
```

- [ ] **Step 2: Run the moved tests to verify they fail**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/supabase --runInBand`

Expected: FAIL because the shared adapter files do not exist.

- [ ] **Step 3: Move adapter logic without changing behavior**

Move the current parsing, error mapping, URL safety and Storage logic to the shared files. Remove default browser client values from constructors:

```ts
export class SupabaseNotificationWriteCommandGateway {
    constructor(private readonly client: NotificationWriteClient) {}
}

export class SupabaseNotificationImageStorage {
    constructor(
        private readonly client: NotificationImageStorageClient,
        private readonly now: () => number = Date.now,
        private readonly supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    ) {}
}
```

- [ ] **Step 4: Keep the browser path working through thin wrappers**

Each browser file should extend or instantiate its shared adapter with `browserSupabaseClient`. Do not duplicate parser or error logic. This preserves the current application while Server Actions are added in the next task.

- [ ] **Step 5: Run adapter, Application service, and architecture tests**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/supabase src/__tests__/modules/notifications/application/save-notification.test.ts src/__tests__/modules/notifications/application/delete-notification.test.ts --runInBand`

Run: `npm run verify:architecture`

Expected: PASS.

- [ ] **Step 6: Commit the adapter extraction**

```bash
git add src/modules/notifications/infrastructure/supabase src/modules/notifications/infrastructure/browser src/__tests__/modules/notifications/infrastructure/browser src/__tests__/modules/notifications/infrastructure/supabase
git commit -m "refactor(notifications): share mutation adapters"
```

### Task 5: Authenticated Notification Server Actions

**Files:**
- Create: `src/modules/notifications/infrastructure/server/supabase-notification-view-command-gateway.ts`
- Create: `src/modules/notifications/infrastructure/server/notification-action-input.ts`
- Create: `src/modules/notifications/infrastructure/server/server-notification-command-services.ts`
- Create: `src/app/notification/actions.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/server/supabase-notification-view-command-gateway.test.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/server/notification-action-input.test.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/server/server-notification-command-services.test.ts`
- Create: `src/__tests__/notification/actions.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `saveNotificationAction(formData: FormData): Promise<Result<NotificationWriteResult>>`
- Produces: `deleteNotificationAction(id: number): Promise<Result<void>>`
- Produces: `recordNotificationViewAction(id: number): Promise<Result<number>>`
- Produces: `parseSaveNotificationFormData(formData: FormData): Result<SaveNotificationCommand>`
- Produces: `authorizeNotificationManager(client): Promise<Result<void>>`
- Consumes: shared mutation adapters from Task 4 and `RecordNotificationViewService` from Task 2

- [ ] **Step 1: Write failing view RPC gateway tests**

Test `rpc('increment_notification_views', { p_notification_id: 17 })`, a valid nonnegative safe integer result, `null` as not-found, malformed values, returned Supabase errors and thrown promises.

```ts
expect(client.rpc).toHaveBeenCalledWith('increment_notification_views', {
    p_notification_id: 17,
});
await expect(gateway.record(17)).resolves.toEqual(ok(41));
```

- [ ] **Step 2: Write failing FormData parser tests**

Cover create/update, keep/remove/replace, required scalar uniqueness, canonical positive ID, exact `true`/`false`, valid ISO date, expected image URL, empty file, non-image MIME and `5 * 1024 * 1024 + 1` bytes.

Use these exact field names:

```text
mode, id, expectedImageUrl, title, body, endsAt,
isImportant, isModal, imageChange, image
```

Empty `expectedImageUrl` maps to `null`. `imageChange=replace` requires exactly one `File`; other modes reject a nonempty `image` field. Create rejects `imageChange=remove`.

- [ ] **Step 3: Write failing authorization and action tests**

Authorization cases:

- `getUser()` without a user returns `unauthorized` before role query;
- a role query returning `data: null` without a Supabase error returns `forbidden`;
- a role query returning an error or throwing returns `infrastructure`;
- `r1` returns `forbidden`;
- `r4` and `admin` return `ok(undefined)`.

Action cases:

- authorization and parsing happen before save/delete service calls;
- create success revalidates only `/notification`;
- update success revalidates `/notification` and `/notification/17`;
- delete success revalidates both paths;
- returned or thrown failures do not call `revalidatePath`;
- view recording never calls `revalidatePath`.

- [ ] **Step 4: Run the new server tests to verify they fail**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/server/supabase-notification-view-command-gateway.test.ts src/__tests__/modules/notifications/infrastructure/server/notification-action-input.test.ts src/__tests__/modules/notifications/infrastructure/server/server-notification-command-services.test.ts src/__tests__/notification/actions.test.ts --runInBand`

Expected: FAIL because the gateway, parser, server composition and actions do not exist.

- [ ] **Step 5: Implement the RPC gateway, parser and server composition**

Use authenticated server client instances for authorization and save/delete/Storage work. Inject the same client into shared adapters so RLS and Storage ownership use the caller session. Use the cookie-free public client for the view RPC because anon callers are allowed.

The authorization result messages are fixed:

```ts
const unauthorized = err({ kind: 'unauthorized', message: '로그인이 필요합니다.' });
const forbidden = err({ kind: 'forbidden', message: '공지사항 관리 권한이 없습니다.' });
const infrastructure = err({ kind: 'infrastructure', message: '공지사항 권한을 확인하지 못했습니다.' });
```

- [ ] **Step 6: Implement the Server Action entrypoints and cache invalidation**

```ts
'use server';

export async function recordNotificationViewAction(id: number): Promise<Result<number>> {
    const service = createPublicNotificationViewService();
    return service.record(id);
}

export async function saveNotificationAction(formData: FormData): Promise<Result<NotificationWriteResult>> {
    const services = await createServerNotificationCommandServices();
    const authorization = await services.authorize();
    if (!authorization.ok) return authorization;
    const command = parseSaveNotificationFormData(formData);
    if (!command.ok) return command;
    const result = await services.notificationWriteService.save(command.value);
    if (result.ok) {
        revalidatePath('/notification');
        if (command.value.mode === 'update') revalidatePath(`/notification/${command.value.id}`);
    }
    return result;
}
```

Apply the same success-only rule to deletion. Unexpected save, delete and view action failures return respectively `공지사항 저장에 실패했습니다.`, `공지사항 삭제에 실패했습니다.`, and `공지사항 조회 수 기록에 실패했습니다.` as `infrastructure` Results.

- [ ] **Step 7: Configure the Server Action body limit**

```ts
experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
},
```

- [ ] **Step 8: Run the server action tests and type check**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/server src/__tests__/notification/actions.test.ts --runInBand`

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 9: Commit the Server Action boundary**

```bash
git add src/modules/notifications/infrastructure/server src/app/notification/actions.ts src/__tests__/modules/notifications/infrastructure/server src/__tests__/notification/actions.test.ts next.config.ts
git commit -m "feat(notifications): add authenticated server actions"
```

### Task 6: Client Hooks, View Counter, and File Validation

**Files:**
- Create: `src/modules/notifications/presentation/notification-command-form-data.ts`
- Create: `src/modules/notifications/presentation/use-record-notification-view.ts`
- Create: `src/app/notification/[id]/NotificationViewCount.tsx`
- Create: `src/__tests__/modules/notifications/presentation/notification-command-form-data.test.ts`
- Create: `src/__tests__/modules/notifications/presentation/use-record-notification-view.test.tsx`
- Create: `src/__tests__/notification/id/NotificationViewCount.test.tsx`
- Modify: `src/modules/notifications/presentation/use-save-notification.ts`
- Modify: `src/modules/notifications/presentation/use-delete-notification.ts`
- Modify: `src/modules/notifications/index.ts`
- Modify: `src/app/notification/components/NotificationWriteForm.tsx`
- Modify: `src/app/notification/[id]/NotificationDetail.tsx`
- Modify: `src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx`
- Modify: `src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx`
- Modify: `src/__tests__/notification/NotificationWriteForm.test.tsx`
- Modify: `src/__tests__/notification/id/NotificationDetail.test.tsx`

**Interfaces:**
- Produces: `toSaveNotificationFormData(command: SaveNotificationCommand): FormData`
- Produces: `useRecordNotificationView(): { record(id: number): Promise<Result<number>> }`
- Produces: `NotificationViewCount({ id, initialViews }: { id: number; initialViews: number })`
- Preserves: `useSaveNotification()` and `useDeleteNotification()` component-facing return signatures
- Consumes: three Server Actions from Task 5

- [ ] **Step 1: Write failing FormData serialization tests**

Assert every create/update scalar uses the exact Task 5 field names, null expected image becomes an empty string, booleans become exact lowercase strings, and replace appends the original `File` under `image`.

- [ ] **Step 2: Rewrite hook tests against mocked Server Actions**

Mock `src/app/notification/actions.ts` instead of `createBrowserNotificationServices`. Preserve pending-state, stable rejected-promise normalization and active-list invalidation assertions. Add an assertion that save passes a `FormData`, while delete passes the exact numeric ID.

- [ ] **Step 3: Write failing view hook and component tests**

Component cases:

```ts
render(<NotificationViewCount id={17} initialViews={40} />);
expect(screen.getByText('40')).toBeInTheDocument();
await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
expect(await screen.findByText('41')).toBeInTheDocument();
```

Also rerender the same ID and assert no second call, rerender ID 18 and assert one new call, and return an error Result to assert the initial number remains visible without an alert.

- [ ] **Step 4: Run the new presentation tests to verify they fail**

Run: `npx jest src/__tests__/modules/notifications/presentation src/__tests__/notification/id/NotificationViewCount.test.tsx --runInBand`

Expected: FAIL because serialization, action-backed hooks and view component are absent.

- [ ] **Step 5: Implement action-backed hooks and serializer**

`useSaveNotification` calls `saveNotificationAction(toSaveNotificationFormData(command))`. `useDeleteNotification` calls `deleteNotificationAction(id)`. Both keep React Query invalidation only for successful Results and normalize rejected action promises to their existing stable infrastructure errors.

`useRecordNotificationView` calls `recordNotificationViewAction`; it catches rejection and returns:

```ts
err({ kind: 'infrastructure', message: '공지사항 조회 수 기록에 실패했습니다.' })
```

- [ ] **Step 6: Implement `NotificationViewCount` and integrate it**

Keep `{ id, initialViews }` in state, reset the displayed value when either prop changes, use an ID ref guard, and update only for a successful action result. Render an `Eye` icon, a visually hidden `조회수` label, and the localized numeric value. Place it in the existing metadata flex row next to the date.

- [ ] **Step 7: Add 5MB client validation**

In `handleImageSelection`, reject `file.size > 5 * 1024 * 1024` or `!file.type.startsWith('image/')`, clear the file input, avoid creating an object URL, and call `onError` with:

```ts
{
    kind: 'validation',
    field: 'image',
    message: '이미지는 5MB 이하의 이미지 파일만 업로드할 수 있습니다.',
}
```

Repeat the size/type guard immediately before FormData submission so programmatic input changes cannot bypass it.

- [ ] **Step 8: Run focused UI and hook tests**

Run: `npx jest src/__tests__/modules/notifications/presentation src/__tests__/notification/NotificationWriteForm.test.tsx src/__tests__/notification/id/NotificationViewCount.test.tsx src/__tests__/notification/id/NotificationDetail.test.tsx --runInBand`

Expected: PASS, including mount-once recording, latest returned count, silent failure and file validation.

- [ ] **Step 9: Commit the client integration**

```bash
git add src/modules/notifications/presentation src/modules/notifications/index.ts src/app/notification src/__tests__/modules/notifications/presentation src/__tests__/notification
git commit -m "feat(notifications): record detail page views"
```

Use `git diff --cached --name-only` before committing and unstage any unrelated words-docs path.

### Task 7: Remove Browser Mutation Composition and Verify the Boundary

**Files:**
- Modify: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- Delete: `src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.ts`
- Delete: `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts`
- Delete: `src/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.ts`
- Delete: `src/modules/notifications/infrastructure/browser/supabase-notification-image-storage.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/browser/browser-notification-services.test.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Produces: `BrowserNotificationServices` containing only `modalNoticeQueryService`
- Consumes: `SupabaseModalNoticeQueryGateway`
- Removes: browser-side notification write/delete/Storage construction

- [ ] **Step 1: Add a failing browser composition boundary assertion**

Assert browser composition has only `modalNoticeQueryService` and its source contains none of these class names:

```text
SaveNotificationService
DeleteNotificationService
SupabaseNotificationWriteCommandGateway
SupabaseNotificationDeleteCommandGateway
SupabaseNotificationImageStorage
```

- [ ] **Step 2: Run the browser notification tests to verify the assertion fails**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser src/__tests__/modules/notifications/presentation --runInBand`

Expected: FAIL because browser command services are still composed.

- [ ] **Step 3: Remove obsolete browser command files and imports**

Leave modal query composition unchanged. Confirm production search has no direct browser command consumer:

Run: `rg -n "createBrowserNotificationServices|SupabaseNotificationWriteCommandGateway|SupabaseNotificationDeleteCommandGateway|SupabaseNotificationImageStorage" src --glob '!src/__tests__/**'`

Expected: only the modal composition factory remains; shared/server adapter names appear only in shared/server files.

- [ ] **Step 4: Update the architecture roadmap notification entry**

Record that public detail/list reads use anon ISR composition, detail views use a separate best-effort Server Action/RPC, and create/update/delete now use authenticated Server Actions with success-only path invalidation. State that `database.types.ts` regeneration waits for remote migration rollout.

- [ ] **Step 5: Run notification and architecture suites**

Run: `npx jest src/__tests__/modules/notifications src/__tests__/notification --runInBand`

Run: `npm run verify:architecture`

Expected: PASS.

- [ ] **Step 6: Commit the browser boundary cleanup**

```bash
git add src/modules/notifications/infrastructure/browser src/__tests__/modules/notifications/infrastructure/browser docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor(notifications): remove browser write boundary"
```

### Task 8: Full Verification and Supabase Type Rollout

**Files:**
- Generated after approved remote migration: `src/app/types/database.types.ts`
- No other planned source changes

**Interfaces:**
- Consumes: completed Tasks 1–7
- Produces: generated `notification.Row.views` and `increment_notification_views` function types matching the deployed schema

- [ ] **Step 1: Run the complete local verification suite**

Run in this order:

```bash
npm run test:notification-db
npm run verify:architecture
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

Expected: every command exits 0. If local Supabase is unavailable, run `npm run verify:local-db`; if it remains unavailable, report the DB command as not run rather than claiming it passed.

- [ ] **Step 2: Inspect the final local change set**

Run:

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: only the user's pre-existing words-docs changes remain uncommitted; notification implementation is committed; `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Request explicit approval before remote schema mutation**

The exact remote operation is applying `supabase/migrations/20260831130000_refactor_notifications.sql` to project `sjqbafovqiydkndodbsb`. Do not run a linked `supabase db push` without explicit approval in the implementation session.

- [ ] **Step 4: Apply the approved migration and regenerate types**

After approval, run:

```bash
npx supabase db push --linked
```

Then regenerate the types:

```bash
npm run gen-type
git diff -- src/app/types/database.types.ts
```

Expected generated diff:

- `notification.Row`, `Insert`, and `Update` include `views` with the generator's number mapping;
- `Functions.increment_notification_views.Args` contains `p_notification_id`;
- `Functions.increment_notification_views.Returns` matches the generated nullable bigint representation;
- unrelated generated tables/functions do not change unless the remote schema already contains separately deployed changes, in which case stop and report the unrelated diff before committing.

- [ ] **Step 5: Re-run type and build verification after generation**

Run: `npx tsc --noEmit`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit generated types only when the diff is scoped**

```bash
git add src/app/types/database.types.ts
git commit -m "chore: regenerate notification database types"
```

- [ ] **Step 7: Perform the production smoke checklist after deployment**

Verify in order:

1. Open an existing notice and observe the displayed count increase by one.
2. Refresh and observe one additional increase.
3. Create a notice with and without an image as an authorized manager.
4. Edit its title/body and confirm list and detail show the new values on the next navigation without waiting 60 seconds.
5. Delete it and confirm `/notification/{id}` resolves through the not-found path.
6. Confirm an unauthenticated request and an `r1` session cannot save or delete.
7. Confirm a failed view request leaves the notice body usable and does not show an error Modal.

Record any unavailable production role/session check explicitly instead of inferring success.
