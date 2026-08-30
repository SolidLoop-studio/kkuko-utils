# DDD-lite Next Ten Vertical Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the next ten user-visible data-access flows from the global `SCM` facade into feature-owned DDD-lite application ports, Supabase adapters, and presentation hooks.

**Architecture:** Each task is one mergeable vertical slice. Domain/Application code exposes `Result<T>` contracts without React, Next.js, Supabase SDK, or generated database types; browser Infrastructure owns Supabase table/RPC knowledge; presentation consumes feature services/hooks and maps stable `ApplicationError` values to the existing Modal/ErrorPage UX. The controller creates a fresh Git worktree and branch for every task, dispatches a fresh implementer and reviewer, verifies, merges to `refactor/db`, removes that worktree, then starts the next task.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, React Query 5, Supabase, Jest, Testing Library, pgTAP where a transactional RPC is added.

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Preserve existing behavior and Korean user-facing copy unless the task explicitly replaces unsafe raw database errors with a stable application message.
- Do not add methods to `SCM`; remove the migrated consumer import and the replaced manager/interface method in the same task.
- Client Components must not call Supabase query builders or `rpc()` directly.
- Domain/Application must not import `@supabase/*`, Next.js, React, or generated database types.
- Use `Result<T>` and stable `ApplicationError`; never show raw database errors in a Modal.
- Multi-table mutations must be a single database transaction/RPC. Database changes are forward migrations and must include real DB behavior/security coverage.
- Do not manually edit `src/app/types/database.types.ts`.
- Follow TDD: record RED and GREEN commands/output in the task report.
- Update `docs/architecture/ddd-lite-migration-roadmap.md` with the exact completed boundary and remaining boundary in every task.
- Before each task commit run its focused Jest tests, `npm run lint`, and `npx tsc --noEmit`; run `npm run verify:local-db` when a migration/RPC changes.
- Before each worktree merge run the full Jest suite; after merging into `refactor/db`, rerun the task-focused tests plus lint and TypeScript checking.

---

### Task 1: Record a docs view as an independent best-effort command

**User action:** After a docs content projection and its word enrichment render successfully, record exactly one view for that mounted docs ID; failure must never replace or block the successful page.

**Files:**
- Create: `src/modules/docs/application/docs-view-command-ports.ts`
- Create: `src/modules/docs/application/record-docs-view.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-view-command-gateway.ts`
- Create: `src/modules/docs/presentation/use-record-docs-view.ts`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/[id]/DocsDataPage.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Test: `src/__tests__/modules/docs/application/record-docs-view.test.ts`
- Test: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-view-command-gateway.test.ts`
- Test: `src/__tests__/modules/docs/presentation/use-record-docs-view.test.tsx`
- Test: `src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx`

**Interfaces:**
- Produce `DocsViewCommandGateway.record(docsId: number): Promise<Result<void>>`.
- Produce `RecordDocsViewService.record(docsId: number): Promise<Result<void>>`, rejecting non-positive/non-integer IDs with `validation`.
- Produce `useRecordDocsView(): { record(docsId: number): Promise<void> }`; it catches rejected promises and discarded error Results because this command is explicitly best-effort.
- Infrastructure calls `increment_doc_views` with `{ doc_id: docsId }` and maps both returned and thrown failures to a stable infrastructure error.

- [ ] Write application, adapter, hook, and integration tests that fail because these contracts do not exist and `DocsDataPage` still calls `SCM.update().docView`.
- [ ] Run `npx jest src/__tests__/modules/docs/application/record-docs-view.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-view-command-gateway.test.ts src/__tests__/modules/docs/presentation/use-record-docs-view.test.tsx src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx --runInBand` and capture the expected RED failures.
- [ ] Implement the minimal port/service/adapter/hook, compose/export it, inject it into `DocsDataPage`, retain the existing once-per-ID and post-enrichment timing, and remove the replaced SCM method/interface member.
- [ ] Run the focused Jest command, lint, and TypeScript checking; capture GREEN output.
- [ ] Update the roadmap and commit with `refactor: migrate docs view command boundary`.

### Task 2: Make docs favorites an authenticated idempotent command

**User action:** A signed-in user can set the current docs as starred or unstarred repeatedly without duplicate rows or failure when the desired state already exists; the UI changes only after success and shows the existing error Modal on failure.

**Files:**
- Create: `supabase/migrations/20260826150000_set_docs_favorite.sql`
- Create: `supabase/tests/database/docs-favorite.integration.sql`
- Create: `src/modules/docs/application/docs-favorite-command-ports.ts`
- Create: `src/modules/docs/application/set-docs-favorite.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-favorite-command-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-favorite.ts`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/[id]/DocsDataHome.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `package.json` only if a focused local-DB script is consistent with existing scripts
- Test: `src/__tests__/modules/docs/application/set-docs-favorite.test.ts`
- Test: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-favorite-command-gateway.test.ts`
- Test: `src/__tests__/modules/docs/presentation/use-docs-favorite.test.tsx`
- Test: `src/__tests__/words-docs/id/DocsDataHome.integration.test.tsx`

**Interfaces:**
- Produce `SetDocsFavoriteCommand = { docsId: number; isStarred: boolean }` and `DocsFavoriteCommandGateway.set(command): Promise<Result<void>>`.
- RPC derives the user ID from `auth.uid()`, requires authentication, inserts with `ON CONFLICT (user_id, docs_id) DO NOTHING` when true, and deletes the caller-owned row when false.
- Public failure codes distinguish unauthenticated/not-found only when the UI can act on them; all unexpected failures map to a stable infrastructure message.
- Hook returns `setFavorite(command): Promise<Result<void>>` and `isPending`; concurrent double submission is disabled by the component.

- [ ] Write failing application, adapter, hook, component, pgTAP behavior, auth, and idempotency tests.
- [ ] Run the focused Jest command and the new DB test against the disposable local stack; capture RED.
- [ ] Implement the forward RPC migration and feature slice, replace `starDocs`/`startDocs`, and remove the two replaced SCM methods/interface members.
- [ ] Run focused Jest, `npm run verify:local-db`, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: migrate docs favorite command boundary`.

### Task 3: Load mission marker timestamps by semantic reference

**User action:** On each mission parent docs page, show child marker timestamps for the fourteen mission characters with one feature query; missing children yield `null` markers and query failure does not break the main docs page.

**Files:**
- Create: `src/modules/docs/application/docs-marker-query-types.ts`
- Create: `src/modules/docs/application/docs-marker-query-ports.ts`
- Create: `src/modules/docs/application/get-docs-markers.ts`
- Create: `src/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.ts`
- Create: `src/modules/docs/presentation/use-docs-markers.ts`
- Modify: `src/modules/docs/infrastructure/browser/browser-docs-services.ts`
- Modify: `src/modules/docs/index.ts`
- Modify: `src/app/words-docs/[id]/DocsDataHome.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Test: `src/__tests__/modules/docs/application/get-docs-markers.test.ts`
- Test: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts`
- Test: `src/__tests__/modules/docs/presentation/use-docs-markers.test.tsx`
- Test: `src/__tests__/words-docs/id/DocsDataHome.integration.test.tsx`

**Interfaces:**
- Produce `DocsMarker = { character: string; docsId: number; lastUpdatedAt: string | null }`.
- `GetDocsMarkersService.get(parentDocsId: number)` validates the identity and delegates; Infrastructure first resolves the parent's immutable `reference_code`, accepts only the three `*.mission` parents, then fetches all `prefix + '.' + romanizedMissionKey` children in one query.
- No `parentId + offset`, legacy ID range, or fourteen-request `Promise.all` remains in presentation.
- The hook owns React Query caching keyed by the parent docs ID and is enabled only for a mission parent that the query service recognizes.

- [ ] Write failing tests for varying PKs, complete ordering, missing child -> null, non-parent validation, and best-effort page rendering.
- [ ] Run the focused Jest tests and capture RED.
- [ ] Implement the semantic bulk query slice, replace the component effect, and remove the read-side SCM `docsLastUpdate(id)` member while retaining the unrelated write overload until Task 6.
- [ ] Run focused Jest, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: migrate docs marker query boundary`.

### Task 4: Reuse the word-catalog theme query in admin theme selection

**User action:** Opening the admin theme selection modal loads the same cached theme DTOs used by word-catalog, preserves numeric/non-numeric grouping and Korean sorting, and presents a stable error state instead of throwing a Supabase error.

**Files:**
- Modify: `src/app/admin/request-words/ThemeSelectModal.tsx`
- Modify: `src/modules/word-catalog/index.ts` only if the existing `WordThemeSummary` export is insufficient
- Test: `src/__tests__/admin/request-words/ThemeSelectModal.test.tsx`
- Test: existing `src/__tests__/modules/word-catalog/presentation/use-word-themes.test.tsx` only if contract coverage is missing

**Interfaces:**
- Consume existing `useWordThemes` and `WordThemeSummary { id; name; code }`; do not create another all-themes gateway.
- Preserve lazy fetch semantics with the hook's `enabled: isOpen` input (extend the hook narrowly if it does not currently accept it).
- Render the current loading UI while pending and an inline stable Korean error state on error; confirming maps selected DTOs back to the existing `Theme` callback contract.

- [ ] Write a failing component test proving the modal no longer needs an SCM/SWR fetcher and handles loading, error, grouping, prior selections, and confirm mapping.
- [ ] Run the focused Jest tests and capture RED.
- [ ] Replace SCM/SWR with the catalog hook and remove the component SCM import.
- [ ] Run focused Jest, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: reuse catalog theme query in moderation`.

### Task 5: Load the administrator pending-word moderation queue through one query service

**User action:** Opening the administrator request-word page loads addition, deletion, and grouped theme-change requests as one stable `PendingWordModerationRequest[]` projection without exposing Supabase rows or assembling three queries in the component.

**Files:**
- Create: `src/modules/word-moderation/application/pending-word-moderation-query-types.ts`
- Create: `src/modules/word-moderation/application/pending-word-moderation-query-ports.ts`
- Create: `src/modules/word-moderation/application/get-pending-word-moderation-requests.ts`
- Create `src/modules/word-moderation/infrastructure/browser/supabase-pending-word-moderation-query-gateway.ts`
- Create `src/modules/word-moderation/presentation/use-pending-word-moderation-requests.ts`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Modify: `src/app/admin/request-words/AdminWrapper.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Test: `src/__tests__/modules/word-moderation/application/get-pending-word-moderation-requests.test.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-pending-word-moderation-query-gateway.test.ts`
- Test: `src/__tests__/modules/word-moderation/presentation/use-pending-word-moderation-requests.test.tsx`
- Test: `src/__tests__/admin/request-words/AdminWrapper.test.tsx`

**Interfaces:**
- Projection exactly supports `AdminRequestHome`: request ID, word, request type, requested timestamp, requester UUID/nickname, optional word ID, and theme entries with id/name/code/type.
- Gateway may use multiple read queries internally but owns chunking, row narrowing, grouping, deterministic IDs for grouped theme-change requests, and stable error mapping.
- Hook uses React Query; `AdminWrapper` renders `LoadingPage`, `ErrorPage`, and passes `refetch` as the existing refresh callback.

- [ ] Characterize existing ordering/grouping and failure behavior with failing tests against the wished-for query service.
- [ ] Run focused Jest and capture RED.
- [ ] Implement the query service/gateway/hook and replace component orchestration and raw `PostgrestError` rendering.
- [ ] Remove only SCM read methods with zero remaining consumers, run focused Jest, lint, and TypeScript checking.
- [ ] Update the roadmap and commit with `refactor: migrate pending word moderation query`.

### Task 6: Add words directly through one administrator transaction

**User action:** An `admin` or `r4` user directly adds one new word and its selected themes, word log, docs logs, and docs last-update effects atomically; duplicates and unauthorized callers fail without partial writes.

**Files:**
- Create: `supabase/migrations/20260826160000_add_direct_word_addition_rpc.sql`
- Create: `supabase/tests/database/direct-word-addition.integration.sql`
- Create: `supabase/tests/database/direct-word-addition-concurrency.integration.sql`
- Create: `src/modules/word-moderation/domain/direct-word-addition.ts`
- Create: `src/modules/word-moderation/application/direct-word-addition-types.ts`
- Create: `src/modules/word-moderation/application/direct-word-addition-ports.ts`
- Create: `src/modules/word-moderation/application/add-word-directly.ts`
- Create: `src/modules/word-moderation/infrastructure/browser/supabase-direct-word-addition-gateway.ts`
- Create: `src/modules/word-moderation/presentation/use-direct-word-addition.ts`
- Modify: `src/app/word/add/WordAddHome.tsx`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Test: `src/__tests__/modules/word-moderation/domain/direct-word-addition.test.ts`
- Test: `src/__tests__/modules/word-moderation/application/add-word-directly.test.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-direct-word-addition-gateway.test.ts`
- Test: `src/__tests__/modules/word-moderation/presentation/use-direct-word-addition.test.tsx`
- Test: `src/__tests__/word/add/WordAddHome.test.tsx`

**Interfaces:**
- Command contains only normalized word text and selected theme codes/IDs needed by the RPC; actor identity/role comes from `auth.uid()` and database role lookup, never the browser payload.
- Database transaction performs duplicate check, word insert, theme relations, word log, unique docs log effects, and last-update changes; returns a stable public code for duplicate, unauthorized, invalid theme, and unexpected failure.
- Application validates word/theme input and returns `Result<DirectWordAdditionResult>`; hook prevents duplicate submission and maps errors to existing Modal/FailModal behavior.
- Reuse word-catalog theme DTO/query and existing `isNoin` domain behavior only through a pure dependency, not through SCM.

- [ ] Write failing pure/application, adapter, component, pgTAP rollback, authorization, duplicate, side-effect, and concurrency tests.
- [ ] Capture focused Jest and DB RED evidence.
- [ ] Implement the migration and complete slice, removing browser call ordering from `WordAddHome`.
- [ ] Run focused Jest, `npm run verify:local-db`, lint, TypeScript checking, and the affected build path; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: make direct word addition atomic`.

### Task 7: Separate Auth session, Google login, state listening, and logout

**User action:** The app restores a session, reacts to auth-state changes, starts Google OAuth, and logs out through a small identity gateway while profile-row lookup remains a separate explicit identity query contract.

**Files:**
- Create: `src/modules/identity/application/auth-types.ts`
- Create: `src/modules/identity/application/auth-ports.ts`
- Create: `src/modules/identity/application/manage-auth-session.ts`
- Create: `src/modules/identity/application/user-profile-query-ports.ts`
- Create: `src/modules/identity/application/get-current-user-profile.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-auth-gateway.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-current-user-profile-query-gateway.ts`
- Create: `src/modules/identity/infrastructure/browser/browser-identity-services.ts`
- Create: `src/modules/identity/presentation/use-auth-session.ts`
- Create: `src/modules/identity/index.ts`
- Modify: `src/app/AutoLogin.tsx`
- Modify: `src/app/auth/auth.tsx`
- Modify: `src/app/header.tsx`
- Remove replaced SCM auth/session/user-by-id methods when no consumer remains
- Test: `src/__tests__/modules/identity/application/manage-auth-session.test.ts`
- Test: `src/__tests__/modules/identity/application/get-current-user-profile.test.ts`
- Test: `src/__tests__/modules/identity/infrastructure/browser/supabase-auth-gateway.test.ts`
- Test: `src/__tests__/modules/identity/infrastructure/browser/supabase-current-user-profile-query-gateway.test.ts`
- Test: `src/__tests__/modules/identity/presentation/use-auth-session.test.tsx`
- Test: `src/__tests__/AutoLogin.test.tsx`
- Test: `src/__tests__/auth/auth.test.tsx`
- Test: `src/__tests__/header.test.tsx`

**Interfaces:**
- Application projection exposes only `{ id; nickname; role }` plus the minimum session presence needed by the UI.
- Auth port owns `getSession`, `onAuthStateChange`, `signInWithGoogle(origin)`, and `signOut`; unsubscribe is explicit.
- Public profile lookup by user ID is a separate query port even if composed beside auth.
- Errors are stable `ApplicationError` values; logout clears Redux only after the command resolves, preserving current navigation behavior.

- [ ] Write failing tests for restore/no-session/error, listener unsubscribe, OAuth redirect origin, and logout state/navigation.
- [ ] Run focused Jest and capture RED.
- [ ] Implement identity boundaries and migrate all three consumers without leaking SDK types.
- [ ] Run focused Jest, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: separate identity auth boundary`.

### Task 8: Register a nickname through an explicit identity use case

**User action:** A newly authenticated user checks nickname availability and registers exactly one profile nickname through stable identity commands; duplicate/invalid/unauthenticated cases never expose database errors.

**Files:**
- Create: `src/modules/identity/application/nickname-types.ts`
- Create: `src/modules/identity/application/nickname-ports.ts`
- Create: `src/modules/identity/application/check-nickname-availability.ts`
- Create: `src/modules/identity/application/register-nickname.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-nickname-query-gateway.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-nickname-command-gateway.ts`
- Create: `src/modules/identity/presentation/use-nickname-registration.ts`
- Modify: `src/modules/identity/infrastructure/browser/browser-identity-services.ts`
- Modify: `src/modules/identity/index.ts`
- Modify: `src/app/auth/auth.tsx`
- Remove replaced `usersByNickname` and `add().nickname` SCM methods only when other consumers have their own query boundary; otherwise retain the shared legacy getter and document the remaining consumers
- Test: `src/__tests__/modules/identity/application/check-nickname-availability.test.ts`
- Test: `src/__tests__/modules/identity/application/register-nickname.test.ts`
- Test: `src/__tests__/modules/identity/infrastructure/browser/supabase-nickname-query-gateway.test.ts`
- Test: `src/__tests__/modules/identity/infrastructure/browser/supabase-nickname-command-gateway.test.ts`
- Test: `src/__tests__/modules/identity/presentation/use-nickname-registration.test.tsx`
- Test: `src/__tests__/auth/auth.test.tsx`

**Interfaces:**
- `CheckNicknameAvailabilityService.check(nickname)` and `RegisterNicknameService.register(nickname)` normalize once and return `Result` contracts.
- Registration actor ID is derived from `auth.uid()` in Infrastructure/DB, not accepted from UI.
- Preserve the current nickname rules from the component as characterization tests; duplicate races are handled by the database unique constraint and mapped to one stable `conflict` error.

- [ ] Write failing tests for normalization, validation, availability, duplicate race mapping, successful registration, and Modal output.
- [ ] Run focused Jest and capture RED.
- [ ] Implement and connect the nickname slice; remove only now-unused SCM members/imports.
- [ ] Run focused Jest, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: migrate nickname registration boundary`.

### Task 9: Query active notifications and modal notices through a notification module

**User action:** Notification list consumers and the global notice hook receive active notices through one cached projection with an explicit modal-notice cache policy and stable failure handling.

**Files:**
- Create: `src/modules/notifications/application/notification-list-query-types.ts`
- Create: `src/modules/notifications/application/notification-list-query-ports.ts`
- Create: `src/modules/notifications/application/get-notification-list.ts`
- Create: `src/modules/notifications/infrastructure/browser/supabase-notification-list-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/browser/browser-notification-services.ts`
- Create: `src/modules/notifications/infrastructure/server/supabase-server-notification-list-query-gateway.ts`
- Create: `src/modules/notifications/infrastructure/server/server-notification-services.ts`
- Create: `src/modules/notifications/presentation/notification-query-keys.ts`
- Create: `src/modules/notifications/presentation/use-modal-notice.ts`
- Create `src/modules/notifications/index.ts`
- Modify: `src/app/hooks/useNotice.ts`
- Modify: `src/app/notification/page.tsx`
- Modify: `src/app/notification/Notification.tsx`
- Remove `SCM.get().notice` only when no consumer remains
- Test: `src/__tests__/modules/notifications/application/get-notification-list.test.ts`
- Test: `src/__tests__/modules/notifications/infrastructure/browser/supabase-notification-list-query-gateway.test.ts`
- Test: `src/__tests__/modules/notifications/infrastructure/server/supabase-server-notification-list-query-gateway.test.ts`
- Test: `src/__tests__/modules/notifications/presentation/use-modal-notice.test.tsx`
- Test: `src/__tests__/hooks/useNotice.test.tsx`
- Test: `src/__tests__/notification/Notification.test.tsx`

**Interfaces:**
- `NotificationListItem` contains `{ id; title; createdAt; isImportant }`; `ModalNotice` contains `{ id; title; body; imageUrl; createdAt; endsAt }`.
- Gateway owns active-time filtering and deterministic ordering; React Query owns cache with a documented stale time and modal selection policy.
- A failed background refresh preserves cached data and does not repeatedly reopen a dismissed modal within the existing dismissal scope.

- [ ] Characterize current list/modal selection and dismissal behavior with failing tests against the new service.
- [ ] Run focused Jest and capture RED.
- [ ] Implement the notifications read slice and migrate consumers.
- [ ] Run focused Jest, lint, and TypeScript checking; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: migrate notification list query`.

### Task 10: Query notification details through a server-safe projection

**User action:** Opening a notification detail or edit page loads one notification projection through the notifications module without importing browser SCM into server-rendered code; not-found and infrastructure errors are distinguishable.

**Files:**
- Create: `src/modules/notifications/application/notification-detail-query-types.ts`
- Create: `src/modules/notifications/application/notification-detail-query-ports.ts`
- Create: `src/modules/notifications/application/get-notification-detail.ts`
- Create: `src/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.ts`
- Modify: `src/modules/notifications/infrastructure/server/server-notification-services.ts`
- Modify: `src/modules/notifications/index.ts`
- Modify: `src/app/notification/[id]/page.tsx`
- Modify: `src/app/notification/[id]/NotificationDetail.tsx`
- Modify: `src/app/notification/[id]/edit/page.tsx`
- Remove `SCM.get().notificationById` when no consumer remains
- Test: `src/__tests__/modules/notifications/application/get-notification-detail.test.ts`
- Test: `src/__tests__/modules/notifications/infrastructure/server/supabase-notification-detail-query-gateway.test.ts`
- Test: `src/__tests__/notification/id/page.test.tsx`
- Test: `src/__tests__/notification/id/edit/page.test.tsx`
- Test: `src/__tests__/notification/id/NotificationDetail.test.tsx`

**Interfaces:**
- `GetNotificationDetailService.get(id: number): Promise<Result<NotificationDetailProjection>>` validates positive integer identity and maps an empty row to `not-found`.
- Browser and server adapters implement the same Application port but use the correct Supabase client factory for their runtime.
- Presentation never sees PostgREST response or database row types.

- [ ] Write failing tests for invalid ID, found/not-found/infrastructure cases, correct runtime composition, and both consumers.
- [ ] Run focused Jest and capture RED.
- [ ] Implement adapters/services and migrate both consumers, removing the legacy getter.
- [ ] Run focused Jest, lint, TypeScript checking, and `npm run build` because a server boundary changed; capture GREEN.
- [ ] Update the roadmap and commit with `refactor: migrate notification detail query`.

## Final Verification

- [ ] Recount direct `SCM` import files and calls; compare to the starting values (27 import files and the calls recorded in the task ledger).
- [ ] Run `npm run lint`, `npx tsc --noEmit`, `npm run test -- --runInBand`, `npm run verify:local-db`, and `npm run build`.
- [ ] Dispatch one whole-range architecture/code review from the commit before Task 1 through Task 10's merged commit; fix and re-review once as required by the SDD workflow.
- [ ] Re-read the roadmap requirements and verify every completed slice has consumer, contract, adapter, error, tests, legacy removal, and roadmap evidence.
