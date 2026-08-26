# Profile Nickname Search Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search Kkuko Utils public profiles by nickname through a stable identity/profile projection instead of exposing full `users` rows through `SCM.get().usersLikeByNickname`.

**Architecture:** Extend the existing identity module with a screen-shaped `ProfileSearchItem`, a small query service/port, a defensive browser Supabase adapter, and an on-demand mutation hook. `ProfileHome` keeps its submit-driven search UI and local result list, but receives only camelCase projection values and stable `ApplicationError`; no cache, API route, database change, or cloud rollout is introduced.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2, TanStack React Query 5, Jest 30, Testing Library

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Limit the slice to `/profile` nickname search; do not change profile detail, activity tabs, nickname editing, auth registration, ranking rules, or routes.
- Treat the ten slices in `docs/superpowers/plans/2026-08-26-ddd-lite-next-ten-slices.md` as completed prerequisites; extend the existing identity module rather than recreating auth/nickname-registration work.
- Normalize the submitted query with `trim()` and reject an empty result with `{ kind: 'validation', field: 'nickname', message: '검색할 닉네임을 입력해주세요.' }` instead of querying every user.
- Preserve case-insensitive contains matching by calling `.ilike('nickname', `%${query}%`)` and preserve the adapter's returned order; do not add ranking, pagination, result limits, or fuzzy search.
- The projection exposes only `id`, `nickname`, `role`, `totalContribution`, and `monthlyContribution`; full generated `users` rows never leave Infrastructure.
- Map a nullable database role to `guest` consistently with the existing identity current-profile adapter; support `guest` in the search card label/variant.
- Presentation must not import `SCM`, Supabase SDK types, database columns, or query builders, and raw database details must not enter `ErrorModal`.
- Remove `usersLikeByNickname` from both legacy manager/interface files once the consumer is migrated.
- Do not edit generated database types, add a Route Handler/migration, run linked Supabase commands, or perform a cloud rollout.
- Follow RED-GREEN TDD, add Korean JSDoc to the public service/gateway/hook, and update the roadmap.

---

### Task 1: Migrate the Profile Nickname Search Vertical Slice

**Files:**
- Create: `src/modules/identity/application/profile-search-query-types.ts`
- Create: `src/modules/identity/application/profile-search-query-ports.ts`
- Create: `src/modules/identity/application/search-profiles-by-nickname.ts`
- Create: `src/modules/identity/infrastructure/browser/supabase-profile-search-query-gateway.ts`
- Create: `src/modules/identity/presentation/use-profile-search.ts`
- Create: `src/__tests__/modules/identity/application/search-profiles-by-nickname.test.ts`
- Create: `src/__tests__/modules/identity/infrastructure/browser/supabase-profile-search-query-gateway.test.ts`
- Create: `src/__tests__/modules/identity/presentation/use-profile-search.test.tsx`
- Create: `src/__tests__/profile/ProfileHome.test.tsx`
- Modify: `src/modules/identity/infrastructure/browser/browser-identity-services.ts`
- Modify: `src/modules/identity/index.ts`
- Modify: `src/app/profile/ProfileHome.tsx`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: existing `IdentityRole`, shared `Result<T>`, `ApplicationError`, and browser Supabase client.
- Produces:

```ts
export interface ProfileSearchItem {
    id: string;
    nickname: string;
    role: IdentityRole;
    totalContribution: number;
    monthlyContribution: number;
}

export interface ProfileSearchQueryGateway {
    searchByNickname(query: string): Promise<Result<ProfileSearchItem[]>>;
}

export class SearchProfilesByNicknameService {
    constructor(private readonly gateway: ProfileSearchQueryGateway) {}
    search(query: string): Promise<Result<ProfileSearchItem[]>>;
}

export const useProfileSearch = (): {
    search(query: string): Promise<Result<ProfileSearchItem[]>>;
    isPending: boolean;
};
```

- [ ] **Step 1: Write the failing Application test**

Cover trim-before-forwarding, blank validation without a gateway call, exact success/error forwarding, and conversion of a rejected gateway promise to `{ kind: 'infrastructure', message: '사용자 검색 중 오류가 발생했습니다.' }`.

Run: `npx jest src/__tests__/modules/identity/application/search-profiles-by-nickname.test.ts --runInBand`

Expected: FAIL because the contract/service files do not exist.

- [ ] **Step 2: Implement the minimal Application types, port, and service; verify GREEN**

The service implementation is:

```ts
async search(query: string): Promise<Result<ProfileSearchItem[]>> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
        return err({
            kind: 'validation',
            field: 'nickname',
            message: '검색할 닉네임을 입력해주세요.',
        });
    }
    try {
        return await this.gateway.searchByNickname(normalizedQuery);
    } catch {
        return err({ kind: 'infrastructure', message: '사용자 검색 중 오류가 발생했습니다.' });
    }
}
```

Run: `npx jest src/__tests__/modules/identity/application/search-profiles-by-nickname.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 3: Write the failing browser adapter test**

Use a narrow thenable fake supporting `from('users')`, `select`, and `ilike`. Assert the exact selection `id, nickname, role, contribution, month_contribution`, `.ilike('nickname', '%테스터%')`, camelCase mapping, `null -> guest`, all six `IdentityRole` values, empty array success, and one stable error for a returned private error, thrown query, malformed ID/nickname/role, negative/non-integer contribution, or malformed array.

Run: `npx jest src/__tests__/modules/identity/infrastructure/browser/supabase-profile-search-query-gateway.test.ts --runInBand`

Expected: FAIL because `SupabaseProfileSearchQueryGateway` does not exist.

- [ ] **Step 4: Implement the defensive adapter; verify GREEN**

Define a local `ProfileSearchQueryClient` and parse from `unknown`. Accept nonnegative safe integer contribution fields and known roles; map all failures to:

```ts
err({ kind: 'infrastructure', message: '사용자 검색 중 오류가 발생했습니다.' })
```

Run: `npx jest src/__tests__/modules/identity/infrastructure/browser/supabase-profile-search-query-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Write the failing hook test, then compose and implement the hook**

Under `QueryClientProvider`, mock `createBrowserIdentityServices`. Cover exact query forwarding, deferred `isPending`, success/error `Result` preservation, and rejected promise conversion. Add `profileSearchQueryService: SearchProfilesByNicknameService` to `BrowserIdentityServices` and compose it with `SupabaseProfileSearchQueryGateway`. Implement the hook with `useMutation<Result<ProfileSearchItem[]>, never, string>` and no query cache because searches run only on explicit submission.

Run before implementation: `npx jest src/__tests__/modules/identity/presentation/use-profile-search.test.tsx --runInBand`

Expected RED: missing hook/composition. Run after implementation with the same command; expected GREEN: PASS.

- [ ] **Step 6: Export the public projection/service/hook**

Export `ProfileSearchItem`, `ProfileSearchQueryGateway`, `SearchProfilesByNicknameService`, and `useProfileSearch` from `src/modules/identity/index.ts`; do not export the Supabase adapter.

- [ ] **Step 7: Write the failing `ProfileHome` component test**

Mock `useProfileSearch` and cover: clicking search forwards the input; Enter uses the same handler; successful results render nickname, total/month contribution, role label, and the existing `/profile/${user.nickname}` link; successful empty results render the existing empty state; failed validation/infrastructure results clear results and render only the stable error message; input clears only after success; the loading overlay and disabled search button follow `isPending`; `guest` renders as `게스트` without indexing an undefined badge variant.

Run: `npx jest src/__tests__/profile/ProfileHome.test.tsx --runInBand`

Expected: FAIL because `ProfileHome` still calls SCM and owns raw PostgREST/loading state.

- [ ] **Step 8: Migrate `ProfileHome` and verify GREEN**

Remove the local database-shaped `user` type, `SCM` import, manual delay, and manual `isLoading`. Consume `ProfileSearchItem[]` and the hook. Await `search(searchInput)`, update results/clear input only for `ok`, and build `ErrorMessage` with fixed `ErrName: 'Profile Search Error'`, `ErrMessage: result.error.message`, `ErrStackRace: null`, and `inputValue: '유저 검색'`. Add `guest: '게스트'` to role labels/variants and disable the button while pending.

Run: `npx jest src/__tests__/profile/ProfileHome.test.tsx src/__tests__/modules/identity/presentation/use-profile-search.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 9: Remove the replaced legacy method**

Run `git grep -n "usersLikeByNickname" -- "src/**/*.ts" "src/**/*.tsx"`; expected before cleanup: only manager/interface definitions. Delete `GetManager.usersLikeByNickname` and `IGetManager.usersLikeByNickname`, then rerun the grep; expected: no output. Keep `usersByNickname`, which profile nickname editing still consumes outside this slice.

- [ ] **Step 10: Update the roadmap and run final verification**

Record the nickname-search projection, explicit-submit hook, stable errors, SCM getter removal, and blank-query validation under Phase 5. Keep identity/profile `부분 완료`; name profile main summary and the observed activity/edit consumers as remaining, and state that no cloud rollout occurred.

Run:

```bash
npx jest src/__tests__/modules/identity src/__tests__/profile/ProfileHome.test.tsx --runInBand
git grep -n -E "SCM|@supabase/supabase-js|\.from\(|\.rpc\(" -- "src/app/profile/ProfileHome.tsx"
git grep -n -E "@supabase|database\.types|next/|react" -- "src/modules/identity/application/*.ts"
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
git status --short
```

Expected: tests/lint/typecheck/diff check exit 0; both architecture greps and the retired-method grep have no output; status contains only named files.

- [ ] **Step 11: Commit the slice**

```bash
git add src/modules/identity src/app/profile/ProfileHome.tsx src/app/lib/supabase/SupabaseClientManager.ts src/app/lib/supabase/ISupabaseClientManager.ts src/__tests__/modules/identity src/__tests__/profile/ProfileHome.test.tsx docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: migrate profile nickname search query"
```
