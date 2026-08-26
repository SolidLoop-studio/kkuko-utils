# Notification Delete Command Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete an administrator-selected notification through a notifications-owned Application command, browser Supabase adapter, and mutation hook instead of `SCM.delete().notificationById`.

**Architecture:** Add a small `DeleteNotificationService` whose port represents only the delete action. A browser adapter performs the existing RLS-protected single-table delete and converts returned/thrown failures to stable `ApplicationError`; a React Query mutation hook exposes pending state and invalidates the shared active-notification cache only after success. `NotificationDetail` keeps its current confirmation, completion, navigation, and administrator-only controls.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2, TanStack React Query 5, Jest 30, Testing Library

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Preserve the existing user action: only the visible administrator control opens confirmation, successful deletion shows the completion Modal, and closing it navigates to `/notification` then refreshes.
- Treat the ten slices in `docs/superpowers/plans/2026-08-26-ddd-lite-next-ten-slices.md` as completed prerequisites; reuse their notification list/detail contracts instead of duplicating them.
- Keep the current database/RLS transaction boundary: this is one `notification` table delete, so no new RPC, Route Handler, migration, service-role client, or cloud rollout is added.
- This slice deletes only the notification row. Notification image lifecycle belongs to the separate notification write/storage slice and is not added to this command.
- The service accepts only a positive safe integer ID and returns stable `validation` or `infrastructure` errors through `Result<void>`.
- Presentation must not import `SCM`, Supabase SDK types, table names, or query builders and must not show raw PostgREST details.
- Do not change the existing edit/detail server query, notification list ordering, modal dismissal semantics, or create/update form.
- Remove the replaced `notificationById` legacy manager/interface method in the same branch.
- Do not manually edit `src/app/types/database.types.ts`; follow RED-GREEN TDD and update the roadmap after implementation.

---

## File Structure

Create:

- `src/modules/notifications/application/notification-delete-command-ports.ts` — narrow delete gateway contract.
- `src/modules/notifications/application/delete-notification.ts` — ID validation and command orchestration.
- `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts` — RLS-protected browser delete adapter.
- `src/modules/notifications/presentation/use-delete-notification.ts` — mutation state and active-list cache invalidation.
- `src/__tests__/modules/notifications/application/delete-notification.test.ts`
- `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts`
- `src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx`

Modify:

- `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- `src/modules/notifications/index.ts`
- `src/app/notification/[id]/NotificationDetail.tsx`
- `src/__tests__/notification/id/NotificationDetail.test.tsx`
- `src/app/lib/supabase/SupabaseClientManager.ts`
- `src/app/lib/supabase/ISupabaseClientManager.ts`
- `docs/architecture/ddd-lite-migration-roadmap.md`

---

### Task 1: Define the Delete Application Contract

**Files:**
- Create: `src/modules/notifications/application/notification-delete-command-ports.ts`
- Create: `src/modules/notifications/application/delete-notification.ts`
- Create: `src/__tests__/modules/notifications/application/delete-notification.test.ts`

**Interfaces:**
- Consumes: `Result<T>` and `err` from `src/shared/application/result.ts`.
- Produces: `NotificationDeleteCommandGateway.deleteById(id: number): Promise<Result<void>>` and `DeleteNotificationService.delete(id: number): Promise<Result<void>>`.

- [ ] **Step 1: Write failing service tests**

Use a typed mocked gateway and assert all invalid IDs are rejected before the port is called:

```ts
it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid id %s',
    async (id) => {
        const gateway = { deleteById: jest.fn() };
        const result = await new DeleteNotificationService(gateway).delete(id);
        expect(result).toEqual(err({
            kind: 'validation',
            message: '올바른 공지사항 ID가 필요합니다.',
        }));
        expect(gateway.deleteById).not.toHaveBeenCalled();
    },
);
```

Add forwarding tests for `ok(undefined)` and an infrastructure `Result`, plus a rejected gateway promise that becomes the stable delete error rather than escaping.

- [ ] **Step 2: Run the service test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/application/delete-notification.test.ts --runInBand`

Expected: FAIL because the port and service do not exist.

- [ ] **Step 3: Implement the narrow port and service**

```ts
export interface NotificationDeleteCommandGateway {
    deleteById(id: number): Promise<Result<void>>;
}

/** 공지사항 삭제 ID를 검증하고 notification command port를 호출합니다. */
export class DeleteNotificationService {
    constructor(private readonly gateway: NotificationDeleteCommandGateway) {}

    async delete(id: number): Promise<Result<void>> {
        if (!Number.isSafeInteger(id) || id <= 0) {
            return err({ kind: 'validation', message: '올바른 공지사항 ID가 필요합니다.' });
        }
        try {
            return await this.gateway.deleteById(id);
        } catch {
            return err({
                kind: 'infrastructure',
                message: '공지사항 삭제에 실패했습니다.',
            });
        }
    }
}
```

- [ ] **Step 4: Run the service test and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/application/delete-notification.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit the Application contract**

```bash
git add src/modules/notifications/application/notification-delete-command-ports.ts src/modules/notifications/application/delete-notification.ts src/__tests__/modules/notifications/application/delete-notification.test.ts
git commit -m "feat: define notification delete command"
```

---

### Task 2: Implement and Compose the Browser Delete Adapter

**Files:**
- Create: `src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts`
- Create: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts`
- Modify: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`

**Interfaces:**
- Consumes: `NotificationDeleteCommandGateway` from Task 1 and `browserSupabaseClient`.
- Produces: `SupabaseNotificationDeleteCommandGateway` and `BrowserNotificationServices.notificationDeleteService: DeleteNotificationService`.

- [ ] **Step 1: Write failing adapter tests with a narrow fake**

Define only the chain the adapter needs:

```ts
type DeleteResponse = { error: unknown };
interface NotificationDeleteQuery extends PromiseLike<DeleteResponse> {
    delete(): NotificationDeleteQuery;
    eq(column: 'id', value: number): NotificationDeleteQuery;
}
export interface NotificationDeleteClient {
    from(table: 'notification'): NotificationDeleteQuery;
}
```

Assert the successful call order `from('notification') -> delete() -> eq('id', 17)`, returned `{ error: null } -> ok(undefined)`, a returned private error -> stable infrastructure error, a malformed response -> the same stable error, and a thrown promise -> the same stable error.

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts --runInBand`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement defensive response mapping**

The adapter must not cast a raw PostgREST response through Application:

```ts
const deleteError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 삭제에 실패했습니다.',
});

async deleteById(id: number): Promise<Result<void>> {
    try {
        const response = await this.client.from('notification').delete().eq('id', id);
        if (!isRecord(response) || response.error !== null) return err(deleteError());
        return ok(undefined);
    } catch {
        return err(deleteError());
    }
}
```

Do not infer `not-found` from a zero-row RLS delete because the legacy action did not distinguish it and the unselected response does not provide a trustworthy count.

- [ ] **Step 4: Compose the service**

Add:

```ts
notificationDeleteService: new DeleteNotificationService(
    new SupabaseNotificationDeleteCommandGateway(),
),
```

to `BrowserNotificationServices` and its factory without changing list-query composition.

- [ ] **Step 5: Run adapter and existing browser notification tests**

Run: `npx jest src/__tests__/modules/notifications/infrastructure/browser --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit Infrastructure and composition**

```bash
git add src/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.ts src/modules/notifications/infrastructure/browser/browser-notification-services.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts
git commit -m "feat: add notification delete gateway"
```

---

### Task 3: Add the Delete Mutation Hook

**Files:**
- Create: `src/modules/notifications/presentation/use-delete-notification.ts`
- Create: `src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx`
- Modify: `src/modules/notifications/index.ts`

**Interfaces:**
- Consumes: `DeleteNotificationService#delete`, `notificationQueryKeys.activeList`, and the browser composition root.
- Produces: `useDeleteNotification(): { deleteNotification(id: number): Promise<Result<void>>; isPending: boolean }`.

- [ ] **Step 1: Write failing hook tests**

Under a `QueryClientProvider`, mock `createBrowserNotificationServices`. Cover a deferred successful command exposing `isPending`, the exact forwarded ID, successful invalidation of `notificationQueryKeys.activeList`, no invalidation for an error `Result`, and conversion of a rejected service promise to the stable infrastructure `Result`.

```ts
expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: notificationQueryKeys.activeList,
});
```

- [ ] **Step 2: Run the hook test and verify RED**

Run: `npx jest src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx --runInBand`

Expected: FAIL because the hook is missing.

- [ ] **Step 3: Implement the hook with success-only invalidation**

```ts
export const useDeleteNotification = () => {
    const queryClient = useQueryClient();
    const [service] = useState<Pick<DeleteNotificationService, 'delete'>>(() => (
        createBrowserNotificationServices().notificationDeleteService
    ));
    const mutation = useMutation<Result<void>, never, number>({
        mutationFn: async (id) => {
            try {
                return await service.delete(id);
            } catch {
                return err({ kind: 'infrastructure', message: '공지사항 삭제에 실패했습니다.' });
            }
        },
        onSuccess: async (result) => {
            if (result.ok) {
                await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.activeList });
            }
        },
    });
    return {
        deleteNotification: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
};
```

- [ ] **Step 4: Export the hook and public port/service types**

Export `DeleteNotificationService`, `NotificationDeleteCommandGateway`, and `useDeleteNotification` from `src/modules/notifications/index.ts`. Do not export the Supabase adapter.

- [ ] **Step 5: Run hook/module tests and verify GREEN**

Run: `npx jest src/__tests__/modules/notifications/application/delete-notification.test.ts src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-delete-command-gateway.test.ts src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit the presentation boundary**

```bash
git add src/modules/notifications/presentation/use-delete-notification.ts src/modules/notifications/index.ts src/__tests__/modules/notifications/presentation/use-delete-notification.test.tsx
git commit -m "feat: expose notification delete hook"
```

---

### Task 4: Connect Notification Detail and Retire the SCM Delete

**Files:**
- Modify: `src/app/notification/[id]/NotificationDetail.tsx`
- Modify: `src/__tests__/notification/id/NotificationDetail.test.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`

**Interfaces:**
- Consumes: `useDeleteNotification` from Task 3.
- Produces: SCM-free `NotificationDetail` delete behavior.

- [ ] **Step 1: Expand the component test before changing production code**

Mock the hook instead of `SCM`, make `ConfirmModal` expose confirm/cancel buttons, and make `CompleteModal` expose its close action. Assert:

- non-admin users do not see edit/delete controls;
- an admin opens confirmation and confirmation calls `deleteNotification(17)` once;
- the delete button is disabled while `isPending`;
- `ok(undefined)` opens the existing completion copy;
- an error `Result` opens `ErrorModal` with `ErrMessage` equal to the stable Application message and no private details;
- closing completion calls `router.push('/notification')` and `router.refresh()`.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npx jest src/__tests__/notification/id/NotificationDetail.test.tsx --runInBand`

Expected: FAIL because the component still imports and calls `SCM`.

- [ ] **Step 3: Replace local delete orchestration**

Use the hook's `isPending` rather than a duplicate `isDeleting` state. The handler consumes `Result` explicitly:

```ts
const result = await deleteNotification(notification.id);
setIsDeleteModalOpen(false);
if (!result.ok) {
    setError({
        ErrName: 'Notification Delete Error',
        ErrMessage: result.error.message,
        ErrStackRace: null,
        inputValue: `Delete ID: ${notification.id}`,
        location: 'NotificationDetail',
    });
    return;
}
setCompleteStatus({
    title: '공지사항이 삭제되었습니다.',
    description: '공지사항이 성공적으로 삭제되었습니다. 목록으로 돌아갑니다.',
});
```

Remove the `SCM` import and raw error logging. Disable both the destructive button and confirm action while pending if `ConfirmModal` supports a pending/disabled prop; otherwise guard the handler with `if (isPending) return` and keep the destructive button disabled.

- [ ] **Step 4: Remove the replaced SCM method**

Delete `DeleteManager.notificationById` and `IDeleteManager.notificationById`. Do not remove notification add/update/storage methods; the next storage/write slice owns them.

- [ ] **Step 5: Run the component test and verify GREEN**

Run: `npx jest src/__tests__/notification/id/NotificationDetail.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 6: Verify the retired path is absent**

Run:

```bash
git grep -n -E "notificationById\(|SCM" -- "src/app/notification/[id]/NotificationDetail.tsx" "src/app/lib/supabase/*.ts"
```

Expected: no `notificationById` output and no `SCM` output from the component.

- [ ] **Step 7: Commit the consumer and cleanup**

```bash
git add src/app/notification/[id]/NotificationDetail.tsx src/__tests__/notification/id/NotificationDetail.test.tsx src/app/lib/supabase/SupabaseClientManager.ts src/app/lib/supabase/ISupabaseClientManager.ts
git commit -m "refactor: migrate notification delete command"
```

---

### Task 5: Update the Roadmap and Verify the Slice

**Files:**
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: completed command, adapter, hook, UI, and legacy cleanup.
- Produces: an accurate Phase 5 status that still lists create/update and image Storage as remaining.

- [ ] **Step 1: Update roadmap completion text**

Record the notification delete command as complete: positive-ID validation, stable error mapping, RLS-protected browser adapter, success-only active-list invalidation, confirmation/completion behavior, and removal of `notificationById`. Keep `notifications/storage` as `부분 완료`; explicitly name create/update plus image cleanup as the next boundary and state that no cloud rollout occurred.

- [ ] **Step 2: Run architecture checks**

Run each command separately:

```bash
git grep -n -E "SCM|@supabase/supabase-js|\.from\(|\.rpc\(" -- "src/app/notification/[id]/NotificationDetail.tsx"
git grep -n -E "@supabase|database\.types|next/|react" -- "src/modules/notifications/application/*.ts"
git grep -n "notificationById" -- "src/**/*.ts" "src/**/*.tsx"
```

Expected: no output.

- [ ] **Step 3: Run focused and full verification**

Run:

```bash
npx jest src/__tests__/modules/notifications src/__tests__/notification/id/NotificationDetail.test.tsx --runInBand
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
git status --short
```

Expected: every command exits 0 and only files named by this plan are changed. No local DB or build run is required because no schema or server boundary changed.

- [ ] **Step 4: Commit roadmap status**

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "docs: record notification delete migration"
```
