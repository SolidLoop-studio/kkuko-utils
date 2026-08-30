# Notification Write and Image Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and update notifications through stable Application commands while moving image upload/public-URL/removal behavior into a dedicated Storage gateway and completing guarded image cleanup for save and delete failures/successes.

**Architecture:** `SaveNotificationService` validates one discriminated create/update command and orchestrates notification-row, image-reference, and Storage ports. The form keeps a selected `File` locally and uploads only during submit; the update adapter uses the form image only as an optimistic expected-value guard and returns the database-verified prior image, while cleanup proceeds only for a managed URL that a fresh database reference query reports unused. After write/storage exists, the same guarded cleanup policy extends the already-merged row-delete command using the deleted row's database-returned image.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2 and Storage JS, TanStack React Query 5, Jest 30, Testing Library

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Preserve notification fields, create/edit routes, Markdown preview, administrator gate, success Modal, and post-success navigation.
- Treat the ten slices in `docs/superpowers/plans/2026-08-26-ddd-lite-next-ten-slices.md` and the notification delete plan as completed prerequisites; reuse notification list/detail/query keys and do not recreate them.
- Serial merge position: **3 of 5**. Start only after the docs-child and notification-delete plans are merged, then merge this plan before profile search. These five plans are intentionally serial and must not be independently cherry-picked from the planning base.
- Preserve the existing date conversion at the presentation boundary: blank non-modal end date uses the current instant and a chosen `yyyy-MM-dd` value is converted with `new Date(endDate).toISOString()`.
- Replace `alert` and raw `PostgrestError` handling with the existing Modal path and stable `ApplicationError` messages.
- Do not upload on file selection. Selection creates a local preview; Storage mutation starts only when the user submits.
- If a new upload succeeds and the notification database create/update fails or throws, call `remove(newPath)` before returning the database error. Cleanup failure must not expose private detail or replace the original save error.
- For update `replace` or `remove`, the caller supplies `expectedImageUrl` only for optimistic concurrency. Infrastructure must constrain the update to the persisted current `img`, return that verified prior value, and report a stable conflict when it is stale/mismatched.
- Remove a verified prior/deleted managed object only after the row mutation commits and a fresh notification reference query succeeds with no remaining row referencing the URL. A shared reference or returned/thrown reference-check failure skips Storage deletion while preserving the committed DB result.
- Never delete a caller-only URL, stale/mismatched URL, external URL, different bucket, path outside `notifications/`, unchanged current image, or shared/uncertain image.
- Post-commit DB reference check plus Storage deletion cannot be one cross-system transaction. This no-migration slice therefore claims only guarded best-effort cleanup: database-authoritative prior value, managed-path check, and fail-closed reference check. It does not claim concurrency-proof garbage collection or cloud rollout.
- A failed upload never calls the database gateway. A successful create/update invalidates the shared active-notification query cache.
- Keep this as existing RLS-protected browser Data API/Storage access: no RPC, Route Handler, migration, generated-type edit, service-role use, local DB change, or cloud rollout.
- Domain/Application must not import Supabase, React, Next.js, or generated database types; avoid `any` and narrow all `unknown` responses in Infrastructure.
- Remove the replaced legacy notification add/update and Storage methods in the same branch, follow RED-GREEN TDD, and update the roadmap.

---

## File Structure

Create:

- `src/modules/notifications/application/notification-write-command-types.ts` — discriminated create/update input, image intent, stable write DTOs.
- `src/modules/notifications/application/notification-write-command-ports.ts` — database and image Storage ports.
- `src/modules/notifications/application/notification-image-reference-query-ports.ts` — remaining-notification reference check used before any old-object removal.
- `src/modules/notifications/application/save-notification.ts` — validation, upload/save/cleanup ordering policy.
- `src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.ts` — notification insert/update mapper.
- `src/modules/notifications/infrastructure/browser/supabase-notification-image-storage.ts` — `public_img/notifications/` upload, public URL, managed-path parsing, and removal.
- `src/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.ts` — fail-closed exact `notification.img` reference query.
- `src/modules/notifications/presentation/use-save-notification.ts` — mutation state and success-only cache invalidation.
- `src/__tests__/modules/notifications/application/save-notification.test.ts`
- `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts`
- `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts`
- `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts`
- `src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx`

Modify:

- `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- `src/modules/notifications/index.ts`
- `src/modules/notifications/application/notification-delete-command-ports.ts`
- `src/modules/notifications/application/delete-notification.ts`
- `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts`
- `src/__tests__/modules/notifications/application/delete-notification.test.ts`
- `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts`
- `src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx`
- `src/app/notification/components/NotificationWriteForm.tsx`
- `src/app/notification/write/NotificationWrite.tsx`
- `src/__tests__/notification/NotificationWriteForm.test.tsx`
- `src/app/lib/supabase/SupabaseClientManager.ts`
- `src/app/lib/supabase/ISupabaseClientManager.ts`
- `docs/architecture/ddd-lite-migration-roadmap.md`

---

### Task 1: Define the Write and Storage Contracts

**Files:**
- Create: `src/modules/notifications/application/notification-write-command-types.ts`
- Create: `src/modules/notifications/application/notification-write-command-ports.ts`
- Create: `src/modules/notifications/application/notification-image-reference-query-ports.ts`
- Create: `src/modules/notifications/application/save-notification.ts`
- Create: `src/__tests__/modules/notifications/application/save-notification.test.ts`

**Interfaces:**
- Consumes: shared `Result<T>`, `ok`, `err`, and `ApplicationError`.
- Produces: `NotificationImageFile`, `NotificationImageChange`, `CreateNotificationCommand`, `UpdateNotificationCommand`, `SaveNotificationCommand`, `NotificationWriteValues`, `NotificationWriteResult`, `PersistedNotificationWriteResult`, `StoredNotificationImage`, `NotificationWriteCommandGateway`, `NotificationImageStorage`, `NotificationImageReferenceQueryGateway`, and `SaveNotificationService.save(command)`.

- [ ] **Step 1: Write failing validation and base-flow tests**

Use typed fakes and cover blank title, blank body, invalid `endsAt`, invalid update ID, create without image, update `keep`, upload failure preventing DB save, and returned/thrown DB errors. Fix the public contracts in the test:

```ts
export interface NotificationImageFile {
    name: string;
    type: string;
    size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export type NotificationImageChange =
    | { kind: 'keep' }
    | { kind: 'remove' }
    | { kind: 'replace'; file: NotificationImageFile };

interface NotificationWriteFields {
    title: string;
    body: string;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
}

export type SaveNotificationCommand =
    | (NotificationWriteFields & {
        mode: 'create';
        imageChange: Exclude<NotificationImageChange, { kind: 'remove' }>;
    })
    | (NotificationWriteFields & {
        mode: 'update';
        id: number;
        expectedImageUrl: string | null;
        imageChange: NotificationImageChange;
    });
```

- [ ] **Step 2: Write the failing cleanup-policy matrix**

Cover these exact ordered effects with an event array:

| Command | Database result | Required events |
| --- | --- | --- |
| create + replace | failure | `upload:new`, `db:create:new-url`, `remove:new-path` |
| update + replace managed old | stale expected image | `upload:new`, `db:update-conflict`, `remove:new-path`; never remove caller URL |
| update + replace verified old | success, unreferenced | `upload:new`, `db:update:new-url`, `references:old-url=false`, `remove:old-path` |
| update + replace verified old | success, shared | `upload:new`, `db:update:new-url`, `references:old-url=true`; no old remove |
| update + remove verified old | success, unreferenced | `db:update:null`, `references:old-url=false`, `remove:old-path` |
| update + keep verified old | success | `db:update:old-url`; no reference check/remove |
| update + replace external old | success | upload/save only; no old remove |

Add cases where cleanup returns `err` or throws: new-file cleanup still returns the original DB error; old-file cleanup still returns the committed `ok` result.

- [ ] **Step 3: Run the Application test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/application/save-notification.test.ts --runInBand`

Expected: FAIL because the types, ports, and service do not exist.

- [ ] **Step 4: Define the narrow ports**

```ts
export interface NotificationWriteValues {
    title: string;
    body: string;
    imageUrl: string | null;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
}

export interface NotificationWriteResult {
    id: number;
    imageUrl: string | null;
}

export interface PersistedNotificationWriteResult extends NotificationWriteResult {
    persistedPreviousImageUrl: string | null;
}

export interface NotificationWriteCommandGateway {
    create(values: NotificationWriteValues): Promise<Result<PersistedNotificationWriteResult>>;
    update(
        id: number,
        expectedImageUrl: string | null,
        values: NotificationWriteValues,
    ): Promise<Result<PersistedNotificationWriteResult>>;
}

export interface NotificationImageReferenceQueryGateway {
    hasReference(imageUrl: string): Promise<Result<boolean>>;
}

export interface StoredNotificationImage {
    path: string;
    publicUrl: string;
}

export interface NotificationImageStorage {
    upload(file: NotificationImageFile): Promise<Result<StoredNotificationImage>>;
    remove(path: string): Promise<Result<void>>;
    managedPathFromPublicUrl(publicUrl: string): string | null;
}
```

- [ ] **Step 5: Implement validation and image resolution**

Reject blank `title`/`body` with `field`, reject an unparsable `endsAt`, and reject invalid update IDs. Preserve submitted title/body rather than silently trimming content. Resolve the image before saving:

```ts
const uploaded = command.imageChange.kind === 'replace'
    ? await this.storage.upload(command.imageChange.file)
    : null;
if (uploaded !== null && !uploaded.ok) return uploaded;

const expectedImageUrl = command.mode === 'update' ? command.expectedImageUrl : null;
const imageUrl = uploaded?.ok
    ? uploaded.value.publicUrl
    : command.imageChange.kind === 'remove' ? null : expectedImageUrl;
```

For create `keep`, `expectedImageUrl` is `null`. Pass `expectedImageUrl` to the update gateway only as its optimistic persisted-row guard; Application must never use it as the cleanup candidate.

- [ ] **Step 6: Implement save-failure cleanup**

Wrap returned and thrown database failures into one `saveResult`. If it fails and a new object exists, await a safe removal helper before returning `saveResult`:

```ts
if (!saveResult.ok) {
    if (uploaded?.ok) await this.bestEffortRemove(uploaded.value.path);
    return saveResult;
}
```

Thrown gateway promises become `{ kind: 'infrastructure', message: '공지사항 저장에 실패했습니다.' }`; cleanup cannot replace that error.

- [ ] **Step 7: Implement fail-closed post-commit old-image cleanup**

Only for update `replace` or `remove`, read `saveResult.value.persistedPreviousImageUrl`, never `command.expectedImageUrl`. After success, resolve the verified URL with `managedPathFromPublicUrl`; if managed and different from the new path, await `imageReferences.hasReference(verifiedUrl)`. Remove only for `ok(false)`. For `ok(true)`, an error `Result`, or a thrown reference query, skip removal and return the committed `{ id, imageUrl }`. Returned/thrown Storage removal failures are also best effort.

- [ ] **Step 8: Run the Application test and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/application/save-notification.test.ts --runInBand`

Expected: PASS for validation, flow, ordering, returned failures, thrown failures, and the complete cleanup matrix.

- [ ] **Step 9: Commit the Application policy**

```bash
git add src/modules/notifications/application/notification-write-command-types.ts src/modules/notifications/application/notification-write-command-ports.ts src/modules/notifications/application/notification-image-reference-query-ports.ts src/modules/notifications/application/save-notification.ts src/__tests__/modules/notifications/application/save-notification.test.ts
git commit -m "feat: define notification write cleanup policy"
```

---

### Task 2: Implement the Notification Row Command Gateway

**Files:**
- Create: `src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts`

**Interfaces:**
- Consumes: `NotificationWriteCommandGateway`, `NotificationWriteValues`, and `browserSupabaseClient`.
- Produces: `SupabaseNotificationWriteCommandGateway.create(values)` and `.update(id, expectedImageUrl, values)` with a database-verified prior image in the result.

- [ ] **Step 1: Write failing create/update mapping tests**

Use a narrow chainable fake and assert the exact snake-case payload:

```ts
{
    title: '점검 안내',
    body: '점검 본문',
    img: 'https://project.supabase.co/storage/v1/object/public/public_img/notifications/new.png',
    end_at: '2026-08-30T00:00:00.000Z',
    is_important: true,
    is_modal: false,
}
```

Create must call `.insert(payload).select('id, img').single()` and map the row to `{ id, imageUrl, persistedPreviousImageUrl: null }`. Update must call `.update(payload).eq('id', 17)`, add `.is('img', null)` when `expectedImageUrl` is `null` or `.eq('img', expectedImageUrl)` otherwise, then `.select('id, img').maybeSingle()`. A matched row maps to `{ id, imageUrl, persistedPreviousImageUrl: expectedImageUrl }`; that prior value is authoritative only because the database predicate matched it.

- [ ] **Step 2: Add failing safe-error tests**

For create and update, cover malformed row, returned private error, thrown query, and error code `23P01`. For update, also cover `null` data from `maybeSingle()` for both stale non-null and stale-null expected images; it must return `{ kind: 'conflict', code: 'NOTIFICATION_STALE_IMAGE', message: '공지사항이 다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.' }`. The overlap case must return:

```ts
err({
    kind: 'conflict',
    code: 'NOTIFICATION_MODAL_OVERLAP',
    message: '모달 공지가 겹쳤습니다 (동일 기간에 모달 공지는 하나만 가능합니다)',
})
```

Every other failure returns `{ kind: 'infrastructure', message: '공지사항 저장에 실패했습니다.' }` without the private message/details.

- [ ] **Step 3: Run the gateway test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts --runInBand`

Expected: FAIL because the gateway is missing.

- [ ] **Step 4: Implement narrow query interfaces and row guards**

The local client type exposes only `from('notification')`, `insert`, `update`, `eq('id', number)`, `eq('img', string)`, `is('img', null)`, `select('id, img')`, `single`, and `maybeSingle`. Narrow responses from `unknown`; accept only a positive safe integer `id` and `img` as string or `null`. The optimistic image predicate and returned result together establish the prior-image authority; never infer it from caller input after an unmatched update.

- [ ] **Step 5: Run the gateway test and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit the database adapter**

```bash
git add src/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts
git commit -m "feat: add notification write gateway"
```

---

### Task 3: Implement the Managed Notification Image Storage Gateway

**Files:**
- Create: `src/modules/notifications/infrastructure/browser/supabase-notification-image-storage.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts`

**Interfaces:**
- Consumes: `NotificationImageStorage`, `NotificationImageFile`, and `browserSupabaseClient`.
- Produces: upload/remove/managed-path behavior limited to bucket `public_img` and prefix `notifications/`.

- [ ] **Step 1: Write failing upload/removal tests**

Inject `now: () => 1_777_777_777_777` and base URL `https://project.supabase.co`. For a file named `notice image.png`, assert upload to `notifications/1777777777777_notice_image.png`, bucket `public_img`, `{ cacheControl: '3600', upsert: false }`, and conversion of the structural file to a `Blob` with its MIME type. Assert the returned `{ path, publicUrl }`, successful removal with `.remove([path])`, and stable errors for returned/thrown failures.

- [ ] **Step 2: Write failing managed-URL tests**

Assert only this URL resolves:

```text
https://project.supabase.co/storage/v1/object/public/public_img/notifications/1777777777777_notice_image.png
```

It returns `notifications/1777777777777_notice_image.png`. Assert `null` for another origin, another bucket, `public_img/avatars/...`, the bare `notifications/` directory, traversal segments, malformed percent encoding, and a non-URL string.

- [ ] **Step 3: Run the Storage test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts --runInBand`

Expected: FAIL because the Storage adapter does not exist.

- [ ] **Step 4: Implement deterministic safe paths and upload**

The constructor accepts optional `client`, `now`, and `supabaseUrl` dependencies; production defaults are `browserSupabaseClient`, `Date.now`, and `process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''`. Replace `/`, `\\`, control characters, and whitespace runs in the basename with `_`; fall back to `image` if empty. Build only `notifications/${now()}_${safeName}`. Read `arrayBuffer()`, create a `Blob`, upload it, call `getPublicUrl(path)`, and validate a nonblank public URL. If public-URL mapping is malformed after upload, call `.remove([path])` before returning the stable upload error.

- [ ] **Step 5: Implement strict managed-path parsing**

Compare `new URL(publicUrl).origin` to the injected Supabase URL origin. Require the exact pathname prefix `/storage/v1/object/public/public_img/`, decode once, reject `.`/`..` segments, require a nonempty basename below `notifications/`, and return the decoded object path. Application never parses URLs itself.

- [ ] **Step 6: Implement stable Storage errors**

Use these public errors only:

```ts
{ kind: 'infrastructure', message: '공지사항 이미지를 업로드하지 못했습니다.' }
{ kind: 'infrastructure', message: '공지사항 이미지를 정리하지 못했습니다.' }
```

Do not convert Storage errors into fake PostgREST errors.

- [ ] **Step 7: Run the Storage test and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 8: Commit the Storage adapter**

```bash
git add src/modules/notifications/infrastructure/browser/supabase-notification-image-storage.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts
git commit -m "feat: isolate notification image storage"
```

---

### Task 4: Implement the Fail-Closed Image Reference Gateway

**Files:**
- Create: `src/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts`

**Interfaces:**
- Consumes: shared `Result<boolean>` and `browserSupabaseClient`.
- Produces: `NotificationImageReferenceQueryGateway.hasReference(imageUrl)` for both update and delete cleanup.

- [ ] **Step 1: Write the failing reference-query tests**

Use a narrow Supabase fake and assert `from('notification').select('id', { count: 'exact', head: true }).eq('img', imageUrl)`. Cover `{ error: null, count: 0 } -> ok(false)`, count `1` or greater -> `ok(true)`, and a returned private error, thrown query, `null` count, negative count, or non-integer count -> `err({ kind: 'infrastructure', message: '공지사항 이미지 참조를 확인하지 못했습니다.' })` with no private detail.

- [ ] **Step 2: Run the reference-query test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts --runInBand`

Expected: FAIL because the port and adapter do not exist.

- [ ] **Step 3: Implement and verify the exact-count adapter**

Implement the narrow chain and defensive `unknown` response guard. A cleanup caller may remove an object only for `ok(false)`; every uncertain response is fail-closed. Rerun the command from Step 2.

Expected: PASS.

- [ ] **Step 4: Commit the reference gateway**

```bash
git add src/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts
git commit -m "feat: guard notification image cleanup"
```

---

### Task 5: Compose and Expose the Save Mutation Hook

**Files:**
- Modify: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- Create: `src/modules/notifications/presentation/use-save-notification.ts`
- Create: `src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx`
- Modify: `src/modules/notifications/index.ts`

**Interfaces:**
- Consumes: `SaveNotificationService`, the Task 2–4 adapters, and `notificationQueryKeys.activeList`.
- Produces: `BrowserNotificationServices.notificationWriteService` and `useSaveNotification(): { saveNotification(command): Promise<Result<NotificationWriteResult>>; isPending: boolean }`.

- [ ] **Step 1: Write failing composition/hook tests**

Mock browser services under `QueryClientProvider`. Cover exact command forwarding, deferred pending state, successful active-list invalidation, no invalidation for an error `Result`, and rejected service promises becoming `{ kind: 'infrastructure', message: '공지사항 저장에 실패했습니다.' }`.

- [ ] **Step 2: Run the hook test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx --runInBand`

Expected: FAIL because composition and hook are absent.

- [ ] **Step 3: Compose one service with both ports**

```ts
notificationWriteService: new SaveNotificationService(
    new SupabaseNotificationWriteCommandGateway(),
    new SupabaseNotificationImageStorage(),
    new SupabaseNotificationImageReferenceQueryGateway(),
),
```

- [ ] **Step 4: Implement success-only invalidation**

Use `useMutation<Result<NotificationWriteResult>, never, SaveNotificationCommand>`. Catch rejected service promises in `mutationFn`; in `onSuccess`, await `queryClient.invalidateQueries({ queryKey: notificationQueryKeys.activeList })` only when `result.ok`.

- [ ] **Step 5: Export stable types, service, and hook**

Export `SaveNotificationCommand`, `NotificationImageChange`, `NotificationImageFile`, `NotificationWriteResult`, `SaveNotificationService`, and `useSaveNotification` from `src/modules/notifications/index.ts`. Do not export either Supabase adapter.

- [ ] **Step 6: Run hook and all new module tests**

Run: `npx jest src/__tests__/modules/notifications/application/save-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-write-command-gateway.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-storage.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: Commit composition and hook**

```bash
git add src/modules/notifications/infrastructure/browser/browser-notification-services.ts src/modules/notifications/presentation/use-save-notification.ts src/modules/notifications/index.ts src/__tests__/modules/notifications/presentation/use-save-notification.test.tsx
git commit -m "feat: expose notification write hook"
```

---

### Task 6: Migrate the Write Form to Deferred Uploads and Stable Errors

**Files:**
- Modify: `src/app/notification/components/NotificationWriteForm.tsx`
- Modify: `src/app/notification/write/NotificationWrite.tsx`
- Modify: `src/__tests__/notification/NotificationWriteForm.test.tsx`

**Interfaces:**
- Consumes: `useSaveNotification`, `SaveNotificationCommand`, and `ApplicationError`.
- Produces: an SCM-free form whose selected image is uploaded only as part of save.

- [ ] **Step 1: Expand component tests before production changes**

Mock `useSaveNotification`, `URL.createObjectURL`, and `URL.revokeObjectURL`; remove the `SCM` mock. Cover:

- existing edit fields and image preview;
- selecting a file creates a local preview but does not call a service until submit;
- create submit sends `mode: 'create'` plus `{ kind: 'replace', file }`;
- edit without image changes sends `mode: 'update'`, `expectedImageUrl`, and `{ kind: 'keep' }`;
- removing the existing edit image sends `{ kind: 'remove' }`;
- replacing an existing image sends `{ kind: 'replace', file }` and revokes the superseded object URL;
- unmount revokes the active object URL;
- blank title/body or missing modal end date calls `onError` with a stable validation error and never calls save;
- service error calls `onError(error)` and does not show completion;
- success shows the current completion copy and close preserves existing navigation/refresh;
- submit and file buttons are disabled while `isPending`.

- [ ] **Step 2: Run the form test and verify RED**

Run: `npx jest src/__tests__/notification/NotificationWriteForm.test.tsx --runInBand`

Expected: FAIL because the form still uploads immediately through SCM and accepts `PostgrestError`.

- [ ] **Step 3: Replace image state with an explicit local selection**

Use a discriminated local state containing `kind`, optional `file`, `previewUrl`, and `fileName`. Initial edit state is `keep` with `notification.imageUrl`; initial create state is `keep` with `null`. On selection create one object URL; on replacement/removal/unmount revoke only object URLs created by this component. Never revoke the existing remote URL.

- [ ] **Step 4: Build and submit the Application command**

Keep the selected `File` structural value and build one of:

```ts
const command: SaveNotificationCommand = notification
    ? {
        mode: 'update',
        id: notification.id,
        expectedImageUrl: notification.imageUrl,
        title,
        body,
        endsAt,
        isImportant,
        isModal,
        imageChange,
    }
    : {
        mode: 'create',
        title,
        body,
        endsAt,
        isImportant,
        isModal,
        imageChange: imageChange.kind === 'remove' ? { kind: 'keep' } : imageChange,
    };
```

Await `saveNotification(command)`, call `onError` for a failed `Result`, and open completion only for success.

- [ ] **Step 5: Replace the raw error callback**

Change `NotificationWriteProps.onError` to `(error: ApplicationError) => void`. In `NotificationWrite`, render `ErrorModal` with a fixed `ErrName`, `ErrMessage: error.message`, `ErrStackRace: null`, and no database code/details. The gateway's stable conflict message preserves the modal-overlap UX.

- [ ] **Step 6: Run form/edit-page tests and verify GREEN**

Run: `npx jest src/__tests__/notification/NotificationWriteForm.test.tsx src/__tests__/notification/id/edit/page.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: Verify presentation has no direct data access or alert**

Run:

```bash
git grep -n -E "SCM|PostgrestError|\.from\(|\.rpc\(|alert\(" -- "src/app/notification/components/NotificationWriteForm.tsx" "src/app/notification/write/NotificationWrite.tsx"
```

Expected: no output.

- [ ] **Step 8: Commit the migrated form**

```bash
git add src/app/notification/components/NotificationWriteForm.tsx src/app/notification/write/NotificationWrite.tsx src/__tests__/notification/NotificationWriteForm.test.tsx
git commit -m "refactor: migrate notification write form"
```

---

### Task 7: Complete Managed-Image Cleanup After Notification Delete

**Files:**
- Modify: `src/modules/notifications/application/notification-delete-command-ports.ts`
- Modify: `src/modules/notifications/application/delete-notification.ts`
- Modify: `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts`
- Modify: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- Modify: `src/__tests__/modules/notifications/application/delete-notification.test.ts`
- Modify: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts`
- Modify: `src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx`

**Interfaces:**
- Consumes: the already-merged delete command and this plan's Storage/reference ports.
- Produces: database-authoritative deleted-image cleanup without changing `useDeleteNotification`'s public `Promise<Result<void>>` contract.

- [ ] **Step 1: Write failing deleted-row gateway tests**

Define `DeletedNotification = { id: number; imageUrl: string | null }` and change `NotificationDeleteCommandGateway.deleteById(id)` to `Promise<Result<DeletedNotification>>`. Assert the adapter's `deleteById` uses `.delete().eq('id', id).select('id, img').maybeSingle()`, maps a valid deleted row, and returns the existing `{ kind: 'infrastructure', message: '공지사항 삭제에 실패했습니다.' }` for missing, malformed, returned-error, and thrown responses, preserving the preceding slice's no-not-found distinction. The deleted row is the sole authority for the cleanup candidate; the command accepts no image URL.

- [ ] **Step 2: Write the failing delete-cleanup policy matrix**

Construct `DeleteNotificationService(gateway, storage, imageReferences)` and record ordered effects. Cover: managed/unreferenced -> `db:delete`, `references:url=false`, `remove:path`; managed/shared -> DB/reference only; external or null image -> DB only; reference query returned error or throw -> skip removal and return committed success; Storage removal returned error or throw -> return committed success; row deletion failure/throw -> no reference check/removal. Also prove the service returns public `Result<void>` and never accepts a caller-supplied previous image.

- [ ] **Step 3: Run delete tests and verify RED**

Run: `npx jest src/__tests__/modules/notifications/application/delete-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx --runInBand`

Expected: FAIL because the merged delete service is row-only and its gateway returns `Result<void>`.

- [ ] **Step 4: Implement post-commit, fail-closed cleanup**

Delete the row first. Only after a successful returned deleted row, parse `deleted.imageUrl` with `managedPathFromPublicUrl`; for a managed URL call `hasReference(deleted.imageUrl)` and call `remove(path)` only for `ok(false)`. Treat shared references and all uncertain reference results as no-delete. Swallow only post-commit cleanup failures; preserve row-delete failures and never perform cleanup before the row commit.

- [ ] **Step 5: Update composition and preserve the presentation contract**

Compose the delete service with `SupabaseNotificationDeleteCommandGateway`, the same `SupabaseNotificationImageStorage`, and the same `SupabaseNotificationImageReferenceQueryGateway`. Update typed hook fakes for the internal return change while retaining `useDeleteNotification().deleteNotification(id): Promise<Result<void>>`, existing success invalidation, and existing UI behavior.

- [ ] **Step 6: Run delete and lifecycle tests and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/application/delete-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx src/__tests__/modules/notifications/application/save-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-image-reference-query-gateway.test.ts --runInBand`

Expected: PASS for DB-authoritative prior images, stale-update rejection/new-upload cleanup, shared-reference retention, managed delete cleanup, and best-effort failure handling.

- [ ] **Step 7: Commit delete lifecycle completion**

```bash
git add src/modules/notifications/application/notification-delete-command-ports.ts src/modules/notifications/application/delete-notification.ts src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts src/modules/notifications/infrastructure/browser/browser-notification-services.ts src/__tests__/modules/notifications/application/delete-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx
git commit -m "refactor: complete notification delete image cleanup"
```

---

### Task 8: Remove Legacy Write/Storage Methods, Update Roadmap, and Verify

**Files:**
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: completed notification write and Storage slice.
- Produces: no legacy notification write/Storage facade and accurate roadmap status.

- [ ] **Step 1: Prove the old members have no consumers**

Run:

```bash
git grep -n -E "SCM\.(uploadImage|deleteImage|getPublicUrl)|SCM\.(add|update)\(\)\.notification" -- "src/**/*.ts" "src/**/*.tsx"
```

Expected: no output after Task 6.

- [ ] **Step 2: Remove only the replaced legacy surface**

Delete `AddManager.notification`, `UpdateManager.notification`, `SupabaseClientManager.uploadImage`, `SupabaseClientManager.deleteImage`, and `SupabaseClientManager.getPublicUrl`. Delete `IAddManager.notification` and `IUpdateManager.notification`, then remove the legacy `notification` DB-row alias if it has no remaining interface use. Preserve the already migrated delete/query APIs and every unrelated SCM method.

- [ ] **Step 3: Update the roadmap**

Mark notification create/update and image Storage boundaries complete, and close the notification-delete image-lifecycle item left by the preceding plan. Record the exact cleanup policy: new upload removal on DB failure; database-verified managed replaced/removed/deleted image removal only after DB success, a fresh zero-reference result, and best effort; shared, external, stale, or uncertain URLs are never removed. State the no-migration limitation: this guarded best effort is not concurrency-proof garbage collection. State that the form no longer exposes PostgREST errors or uses `alert`, and that no database migration or cloud rollout occurred. Keep notifications/storage `부분 완료` if any inspected notification boundary remains; otherwise mark only the notification sub-boundary complete without claiming global SCM completion.

- [ ] **Step 4: Run architecture checks**

Run each command separately:

```bash
git grep -n -E "SCM|@supabase/supabase-js|\.from\(|\.rpc\(|alert\(" -- "src/app/notification/**/*.ts" "src/app/notification/**/*.tsx"
git grep -n -E "@supabase|database\.types|next/|react" -- "src/modules/notifications/application/*.ts"
git grep -n -E "uploadImage\(|deleteImage\(|getPublicUrl\(|notification\(id: number|notification\(data:" -- "src/app/lib/supabase/*.ts"
git grep -n "previousImageUrl" -- "src/modules/notifications/**/*.ts" "src/app/notification/**/*.tsx" "src/__tests__/modules/notifications/**/*.ts" "src/__tests__/modules/notifications/**/*.tsx" "src/__tests__/notification/**/*.tsx"
git grep -n -E "expectedImageUrl|persistedPreviousImageUrl|hasReference|DeletedNotification" -- "src/modules/notifications/**/*.ts" "src/__tests__/modules/notifications/**/*.ts" "src/__tests__/modules/notifications/**/*.tsx"
```

Expected: the first four forbidden-pattern commands produce no output; the final positive contract grep prints the update guard, DB-verified prior-image, reference-query, and deleted-row declarations/usages. Existing server notification composition imports belong to Infrastructure, not `src/app/notification` presentation. These checks run at serial position 3 after the notification-delete predecessor is merged, so the whole-presentation no-SCM expectation is valid.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
npx jest src/__tests__/modules/notifications src/__tests__/notification --runInBand
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
git status --short
```

Expected: every command exits 0 and only files named by this plan are changed. Do not run local/linked/cloud Supabase commands because the implementation uses existing policies and schema.

- [ ] **Step 6: Commit cleanup and roadmap status**

```bash
git add src/app/lib/supabase/SupabaseClientManager.ts src/app/lib/supabase/ISupabaseClientManager.ts docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: retire legacy notification write storage"
```
