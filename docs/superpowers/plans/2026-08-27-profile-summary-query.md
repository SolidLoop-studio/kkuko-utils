# Profile Summary Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load a public profile's main identity, total/month contribution, monthly rank, and gap-filled recent five-month contribution chart through one identity/profile projection instead of three legacy SCM getters.

**Architecture:** A browser gateway owns the `users` query, monthly-rank RPC, and ordered historical-contribution query and maps them to a camelCase source DTO. `GetProfileSummaryService` validates the nickname, converts missing users to `not-found`, and deterministically fills the current month plus four preceding months using an injectable clock; a React Query hook supplies the projection to the existing client page. The existing activity-tab loaders and nickname-edit command remain unchanged and keep their SCM dependency for later slices.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2, TanStack React Query 5, Jest 30, Testing Library, Recharts

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Scope includes only the profile card/main summary, monthly contribution rank, and recent-five-month chart on `/profile/[username]`.
- Treat the ten slices in `docs/superpowers/plans/2026-08-26-ddd-lite-next-ten-slices.md` and the profile nickname-search plan as completed prerequisites; extend the same identity module.
- Serial merge position: **5 of 5**. Start only after the docs-child, notification-delete, notification-write/Storage, and profile-search plans are implemented and merged. These five plans are intentionally serial and must not be independently cherry-picked from the planning base; run final greps against that merged predecessor state.
- Do not migrate or refactor favorite docs, request history, processed history, nickname availability/edit, Redux nickname update, or `/api/auth/update_nickname`; `starredDocsById`, `requestsListById`, `logsListById`, and `usersByNickname` remain.
- Preserve the existing user fields and non-guest role/progress/admin-dashboard behavior. The projection uses `IdentityRole`, maps nullable role to `guest` consistently with profile search, and renders guest explicitly as label `게스트`, gray badge `bg-gray-100 text-gray-800`, with no role-progress/max-level/admin-level panel.
- Historical query selects the latest four stored months with `.order('month', { ascending: false }).limit(4)`; the current `users.month_contribution` value is authoritative for the current month.
- Return exactly five ascending `YYYY-MM` points from current month minus four through current month, fill missing months with `0`, ignore stored months outside that window, and overwrite any stored current-month row with the current user value.
- Domain/Application must not import Supabase, React, Next.js, Recharts, or generated DB types. Infrastructure narrows `unknown` and presentation sees only stable DTOs/errors.
- This is a browser read boundary using existing RLS/RPC. Do not add an API route, migration, service-role client, database test, generated-type edit, or cloud rollout.
- Remove only `userByNickname`, `monthlyConRankByUserId`, and `monthlyContributionsByUserId` from SCM after migration.
- Follow RED-GREEN TDD, keep raw database errors out of Modal, and update the roadmap.

---

### Task 1: Migrate the Profile Main Summary Vertical Slice

**Files:**
- Create: `src/modules/identity/application/profile-summary-query-types.ts`
- Create: `src/modules/identity/application/profile-summary-query-ports.ts`
- Create: `src/modules/identity/application/get-profile-summary.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-profile-summary-query-gateway.ts`
- Create: `src/modules/identity/presentation/use-profile-summary.ts`
- Create: `src/__tests__/modules/identity/application/get-profile-summary.test.ts`
- Create: `src/__tests__/modules/identity/infrastructure/browser/supabase-profile-summary-query-gateway.test.ts`
- Create: `src/__tests__/modules/identity/presentation/use-profile-summary.test.tsx`
- Create: `src/__tests__/profile/id/ProfilePage.test.tsx`
- Modify: `src/modules/identity/infrastructure/browser/browser-identity-services.ts`
- Create: `src/modules/identity/presentation/identity-query-keys.ts`
- Modify: `src/modules/identity/index.ts`
- Modify: `src/app/profile/[username]/ProfilePage.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: existing `IdentityRole`, shared `Result<T>`, browser Supabase client, and an injectable `clock: () => Date`.
- Produces:

```ts
export interface ProfileMonthlyContribution {
    month: string; // canonical YYYY-MM
    contribution: number;
}

export interface ProfileSummarySource {
    id: string;
    nickname: string;
    role: IdentityRole;
    totalContribution: number;
    monthlyContribution: number;
    monthlyContributionRank: number;
    historicalMonthlyContributions: ProfileMonthlyContribution[];
}

export interface ProfileSummaryProjection
    extends Omit<ProfileSummarySource, 'historicalMonthlyContributions'> {
    recentMonthlyContributions: ProfileMonthlyContribution[];
}

export interface ProfileSummaryQueryGateway {
    loadByNickname(nickname: string): Promise<Result<ProfileSummarySource | null>>;
}

export class GetProfileSummaryService {
    constructor(
        private readonly gateway: ProfileSummaryQueryGateway,
        private readonly clock: () => Date = () => new Date(),
    ) {}
    get(nickname: string): Promise<Result<ProfileSummaryProjection>>;
}

export const useProfileSummary = (nickname: string): UseQueryResult<
    ProfileSummaryProjection,
    ApplicationError
>;
```

- [ ] **Step 1: Write the failing Application service test**

Cover trimmed nickname forwarding, blank validation, `ok(null)` -> `{ kind: 'not-found', message: '사용자를 찾을 수 없습니다.' }`, exact gateway error forwarding, rejected gateway promise -> stable infrastructure error, and recent-month filling with a clock fixed at `2026-08-27T03:00:00+09:00`.

Use history containing `2026-04`, `2026-06`, duplicate `2026-07`, stored `2026-08`, and out-of-window `2025-12`; assert exactly:

```ts
[
    { month: '2026-04', contribution: 4 },
    { month: '2026-05', contribution: 0 },
    { month: '2026-06', contribution: 6 },
    { month: '2026-07', contribution: 7 },
    { month: '2026-08', contribution: 42 },
]
```

The gateway fixture's `monthlyContribution: 42` must override stored August. Define duplicate resolution as last source entry wins and test it explicitly.

Run: `npx jest src/__tests__/modules/identity/application/get-profile-summary.test.ts --runInBand`

Expected: FAIL because the types/port/service do not exist.

- [ ] **Step 2: Implement the pure service and verify GREEN**

Normalize with `trim()`. Build five keys with year/month rollover and `padStart(2, '0')`, use a `Map` for history, then set the current key to `source.monthlyContribution` after history. Return the source without `historicalMonthlyContributions` plus `recentMonthlyContributions`.

Run: `npx jest src/__tests__/modules/identity/application/get-profile-summary.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 3: Write the failing browser gateway test**

Use a narrow fake for:

```text
from('users').select('id, nickname, role, contribution, month_contribution').eq('nickname', nickname).maybeSingle()
rpc('get_user_monthly_rank', { uid: userId })
from('user_month_contributions').select('month, contribution').eq('user_id', userId).order('month', { ascending: false }).limit(4)
```

Assert `ok(null)` stops before rank/history calls. Assert successful camelCase mapping, `null -> guest`, nonnegative safe integer contribution/rank validation, canonical month extraction from ISO/date strings, and stable `{ kind: 'infrastructure', message: '프로필 정보를 불러오는 중 오류가 발생했습니다.' }` for every returned/thrown/malformed stage. Ensure no private database message survives serialization.

Run: `npx jest src/__tests__/modules/identity/infrastructure/browser/supabase-profile-summary-query-gateway.test.ts --runInBand`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the sequential defensive adapter and verify GREEN**

Query the user first; only after a valid row succeeds, run rank and ordered history concurrently with `Promise.all`. Parse all responses from `unknown`; accept months whose first seven characters are canonical valid `YYYY-MM`. Return a source DTO, never generated rows or PostgREST responses.

Run: `npx jest src/__tests__/modules/identity/infrastructure/browser/supabase-profile-summary-query-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Write the failing hook test, then compose and implement it**

Add `profileSummaryQueryService: GetProfileSummaryService` to `BrowserIdentityServices` and compose it with `SupabaseProfileSummaryQueryGateway`. Define `identityQueryKeys.profileSummary(nickname)` as `['identity', 'profile-summary', nickname.trim()]`. Under `QueryClientProvider`, cover trimmed key/service input, disabled blank input, projection/error propagation, stable rejected-promise mapping, and distinct nickname cache entries. Use `retry: false`; global stale time remains the project's one-minute default.

Run before implementation: `npx jest src/__tests__/modules/identity/presentation/use-profile-summary.test.tsx --runInBand`

Expected RED: missing key/composition/hook. Run after implementation with the same command; expected GREEN: PASS.

- [ ] **Step 6: Export only stable identity/profile APIs**

Export the source/projection/month DTOs, gateway port, `GetProfileSummaryService`, `identityQueryKeys`, and `useProfileSummary` from `src/modules/identity/index.ts`; do not export the Supabase adapter.

- [ ] **Step 7: Write the failing focused `ProfilePage` test**

Mock `useProfileSummary` and keep a narrow SCM mock only for the explicitly excluded activity tabs/nickname edit. Cover loading overlay, stable summary error Modal, all card fields/rank/chart points/admin dashboard behavior from the projection, and that successful summary triggers the existing three activity loaders once with the projection ID. Add a `role: 'guest'` projection case that asserts the `게스트` label, `bg-gray-100 text-gray-800` badge class, and absence of the next-role progress, max-level, and admin-level panels. Assert the component never calls legacy `userByNickname`, `monthlyConRankByUserId`, or `monthlyContributionsByUserId`. Keep nickname-edit interactions out of this test.

Run: `npx jest src/__tests__/profile/id/ProfilePage.test.tsx --runInBand`

Expected: FAIL because the mount effect still performs the three summary SCM calls.

- [ ] **Step 8: Replace only the main-summary portion of the mount effect**

Consume `useProfileSummary(userName)`. Replace the local `role` alias and every role-bearing local state/helper parameter with imported `IdentityRole`, then map successful projection fields into the existing local `user`, `monthlyContributions`, `newNickname`, and `isAdmin` states. Type both lookup tables as `Record<IdentityRole, string>` and include `guest: '게스트'` in `roleNames` plus `guest: 'bg-gray-100 text-gray-800'` in `roleColors`; `getRoleName(role: IdentityRole)` and `getRoleColor(role: IdentityRole)` must therefore be exhaustive and type-checkable.

Add an explicit `case 'guest'` to `getRoleProgress(role: IdentityRole, contribution)` returning `{ current: contribution, target: contribution, nextRole: null, nextRoleName: null, showProgress: false, maxLevel: false, adminLevel: false }`. Preserve every existing `r1`/`r2`/`r3`/`r4`/`admin` branch unchanged. This intentionally renders no progress/status panel for a guest instead of relying on an untyped default fallback. Use a `useRef<string | null>` guard keyed by projection user ID before calling the unchanged `loadTabsData(id)` once. Derive the initial loading overlay from `summaryQuery.isPending`; map `summaryQuery.error.message` to the existing `ErrorModal` without raw codes.

Do not edit `loadTabsData`, `updateNickname`, `handleNicknameUpdate`, the three tab renderers, their state types, or their SCM calls except for type fallout directly caused by the projection.

Run: `npx jest src/__tests__/profile/id/ProfilePage.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 9: Remove exactly the three replaced SCM getters**

Run:

```bash
git grep -n -E "userByNickname|monthlyConRankByUserId|monthlyContributionsByUserId" -- "src/**/*.ts" "src/**/*.tsx"
```

Expected before cleanup: only `SupabaseClientManager.ts` and `ISupabaseClientManager.ts`. Delete those implementations/signatures; rerun and expect no output. Separately run:

```bash
git grep -n -E "starredDocsById|requestsListById|logsListById|usersByNickname" -- "src/app/profile/[username]/ProfilePage.tsx"
```

Expected: those excluded consumers remain.

- [ ] **Step 10: Update the roadmap and verify the complete slice**

Record completion of the profile main summary/rank/recent-five-month projection, latest-four ordered history policy, current-month override, stable errors, and three getter removals. Keep identity/profile `부분 완료` and explicitly list activity tabs and nickname edit as remaining; do not claim they moved. State that no database/cloud rollout occurred.

Run:

```bash
npx jest src/__tests__/modules/identity src/__tests__/profile/id/ProfilePage.test.tsx --runInBand
git grep -n -E "SCM\.get\(\)\.(userByNickname|monthlyConRankByUserId|monthlyContributionsByUserId)" -- "src/app/profile/[username]/ProfilePage.tsx"
git grep -n -E "@supabase|database\.types|next/|react|recharts" -- "src/modules/identity/application/*.ts"
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
git status --short
```

Expected: tests/lint/typecheck/diff check exit 0; both prohibited-dependency greps have no output; status contains only named files. Do not run local DB or cloud commands.

- [ ] **Step 11: Commit the slice**

```bash
git add src/modules/identity src/app/profile/[username]/ProfilePage.tsx src/app/lib/supabase/SupabaseClientManager.ts src/app/lib/supabase/ISupabaseClientManager.ts src/__tests__/modules/identity src/__tests__/profile/id/ProfilePage.test.tsx docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: migrate profile summary query"
```
