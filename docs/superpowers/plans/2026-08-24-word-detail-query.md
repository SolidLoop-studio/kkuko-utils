# Word Detail Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the word detail screen's initial projection and random connected-word lookup from legacy `SCM` calls into the DDD-lite `word-catalog` query boundary without changing visible behavior.

**Architecture:** Add a screen-shaped `WordDetail` DTO and dedicated `WordDetailQueryGateway`, orchestrated by `GetWordDetailService`. A browser Supabase adapter maps raw rows and RPC responses into stable application results; React Query hooks own cache, retry, refresh, and on-demand random lookup state. `WordInfoPage` consumes only those hooks and maps the DTO to `WordInfo` props.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2, TanStack React Query 5, Jest 30, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-24-word-detail-query-design.md`

## Global Constraints

- Do not change public word detail information, mutation policies, routes, or the KkukoWiki API flow.
- Do not add a Next.js Route Handler or database migration for this browser read boundary.
- Domain/Application code must not import Supabase, React, Next.js, or generated database types.
- Client Components must not call Supabase query builders or RPCs directly.
- Preserve approved-word precedence, pending deletion metadata, pending addition display, theme classification, docs concatenation order, and duplicate docs.
- Preserve count-query degradation to `0`, KkukoWiki best-effort failure, random approved-first fallback, and current-word navigation when no random result exists.
- Keep `wordInfoByWord` in legacy SCM because `WordAddHome.tsx` still consumes it; remove only methods whose consumers are replaced.
- Do not manually edit `src/app/types/database.types.ts`.
- Add Korean JSDoc to the public service, gateway, and hooks; avoid `any` and narrow `unknown` responses.
- Run related Jest tests, `npm run lint`, and `npx tsc --noEmit` after code changes.

---

## File Structure

Create:

- `src/modules/word-catalog/application/word-detail-types.ts` — stable screen DTO and random lookup input.
- `src/modules/word-catalog/application/word-detail-ports.ts` — detail query port.
- `src/modules/word-catalog/application/get-word-detail.ts` — validation and not-found conversion.
- `src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.ts` — row/RPC parsing and projection mapping.
- `src/modules/word-catalog/presentation/use-word-detail.ts` — cached detail query hook.
- `src/modules/word-catalog/presentation/use-random-connected-word.ts` — on-demand random lookup hook.
- Corresponding tests under `src/__tests__/modules/word-catalog/**`.
- `src/__tests__/word/search/query/WordInfoPage.test.tsx` — page mapping/navigation characterization.

Modify:

- `src/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.ts`
- `src/modules/word-catalog/presentation/word-catalog-query-keys.ts`
- `src/modules/word-catalog/index.ts`
- `src/app/word/search/[query]/WordInfoPage.tsx`
- `src/app/word/search/[query]/WordInfo.tsx`
- `src/__tests__/word/search/query/WordInfo.test.tsx`
- `src/app/lib/supabase/ISupabaseClientManager.ts`
- `src/app/lib/supabase/SupabaseClientManager.ts`
- `docs/architecture/ddd-lite-migration-roadmap.md`

---

### Task 1: Define the Word Detail Application Contract

**Files:**
- Create: `src/modules/word-catalog/application/word-detail-types.ts`
- Create: `src/modules/word-catalog/application/word-detail-ports.ts`
- Create: `src/modules/word-catalog/application/get-word-detail.ts`
- Test: `src/__tests__/modules/word-catalog/application/get-word-detail.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ok`, and `err` from `src/shared/application/result.ts`.
- Produces: `WordDetail`, `FindRandomConnectedWordInput`, `WordDetailQueryGateway`, and `GetWordDetailService`.

- [ ] **Step 1: Write failing service tests**

Create a typed gateway mock and cover blank input, trimmed forwarding, missing projection, gateway failure, random candidate normalization, empty candidates, and successful `null`:

```ts
const createGateway = (): jest.Mocked<WordDetailQueryGateway> => ({
    findDetail: jest.fn().mockResolvedValue(ok(null)),
    findRandomConnectedWord: jest.fn().mockResolvedValue(ok(null)),
});

it('turns a missing projection into a stable not-found error', async () => {
    const service = new GetWordDetailService(createGateway());
    await expect(service.get('나비')).resolves.toEqual(err({
        kind: 'not-found',
        code: 'WORD_NOT_FOUND',
        message: '단어 정보를 찾을 수 없습니다.',
    }));
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx jest src/__tests__/modules/word-catalog/application/get-word-detail.test.ts --runInBand`

Expected: FAIL because the three Application files do not exist.

- [ ] **Step 3: Define exact DTO and port types**

```ts
export type WordDetailStatus = 'registered' | 'pending-addition' | 'pending-deletion';

export interface WordDetailDocument { id: number; name: string }

export interface WordDetail {
    id: number;
    word: string;
    status: WordDetailStatus;
    canUseInChain: boolean;
    canUseWithoutInjeong: boolean;
    requesterId?: string;
    requesterNickname?: string;
    requestedAt?: string;
    themes: {
        approved: string[];
        pendingAddition: string[];
        pendingDeletion: string[];
    };
    documents: WordDetailDocument[];
    previousWordCount: number;
    nextWordCount: number;
}

export type WordConnectionDirection = 'previous' | 'next';
export interface FindRandomConnectedWordInput {
    direction: WordConnectionDirection;
    letters: string[];
}

export interface WordDetailQueryGateway {
    findDetail(word: string): Promise<Result<WordDetail | null>>;
    findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>>;
}
```

- [ ] **Step 4: Implement the minimal service**

`get` trims the word, returns validation error for blank input, forwards gateway errors unchanged, and converts `ok(null)` to `WORD_NOT_FOUND`. `findRandomConnectedWord` trims/removes blank letters, rejects an empty result, then forwards the normalized input:

```ts
/** 단어 상세 조회 입력을 검증하고 word-catalog 조회 port를 호출한다. */
export class GetWordDetailService {
    constructor(private readonly gateway: WordDetailQueryGateway) {}

    async get(word: string): Promise<Result<WordDetail>> {
        const normalizedWord = word.trim();
        if (!normalizedWord) {
            return err({ kind: 'validation', field: 'word', message: '단어가 필요합니다.' });
        }
        const result = await this.gateway.findDetail(normalizedWord);
        if (!result.ok) return result;
        return result.value === null
            ? err({ kind: 'not-found', code: 'WORD_NOT_FOUND', message: '단어 정보를 찾을 수 없습니다.' })
            : ok(result.value);
    }

    findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>> {
        const letters = input.letters.map((letter) => letter.trim()).filter(Boolean);
        return letters.length === 0
            ? Promise.resolve(err({ kind: 'validation', field: 'letters', message: '연결 글자가 필요합니다.' }))
            : this.gateway.findRandomConnectedWord({ ...input, letters });
    }
}
```

- [ ] **Step 5: Run the Application test**

Run: `npx jest src/__tests__/modules/word-catalog/application/get-word-detail.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit the contract**

```bash
git add src/modules/word-catalog/application/word-detail-types.ts src/modules/word-catalog/application/word-detail-ports.ts src/modules/word-catalog/application/get-word-detail.ts src/__tests__/modules/word-catalog/application/get-word-detail.test.ts
git commit -m "feat: define word detail query contract"
```

---

### Task 2: Implement the Supabase Detail Projection

**Files:**
- Create: `src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.ts`
- Test: `src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts`

**Interfaces:**
- Consumes: `WordDetailQueryGateway#findDetail` from Task 1.
- Produces: `SupabaseWordDetailQueryGateway#findDetail`; declare the class as `implements Pick<WordDetailQueryGateway, 'findDetail'>` in this task, then Task 3 upgrades it to the complete port.

- [ ] **Step 1: Create a chainable fake query client**

The test fake records `from`, `select`, `eq`, `in`, `or`, and `maybeSingle`, returning fixtures for approved/pending words, themes, docs, and counts. Use only `unknown` fixture data and this response:

```ts
type QueryResponse = {
    data: unknown;
    error: { message: string } | null;
    count?: number | null;
};
```

- [ ] **Step 2: Write the failing registered projection test**

Use approved themes `['동물', '지명']`, pending addition `곤충`, pending deletion `지명`, repeated docs, and count fixtures. Assert:

```ts
expect(result).toEqual(ok({
    id: 7,
    word: '나비',
    status: 'registered',
    canUseInChain: true,
    canUseWithoutInjeong: false,
    requesterId: 'adder-1',
    requesterNickname: '추가자',
    requestedAt: '2026-08-20T00:00:00.000Z',
    themes: {
        approved: ['동물'],
        pendingAddition: ['곤충'],
        pendingDeletion: ['지명'],
    },
    documents: [
        { id: 10, name: '비' },
        { id: 11, name: '동물' },
        { id: 11, name: '동물' },
    ],
    previousWordCount: 8,
    nextWordCount: 5,
}));
```

- [ ] **Step 3: Run the test and verify the missing-class failure**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts --runInBand`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Add the narrow client interface and parsers**

```ts
type QueryResponse = { data: unknown; error: unknown; count?: number | null };
interface WordDetailQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string, options?: { count?: 'exact'; head?: boolean }): WordDetailQueryBuilder;
    eq(column: string, value: unknown): WordDetailQueryBuilder;
    in(column: string, values: readonly unknown[]): WordDetailQueryBuilder;
    or(filters: string): WordDetailQueryBuilder;
    maybeSingle(): Promise<QueryResponse>;
}
interface WordDetailQueryClient {
    from(table: string): WordDetailQueryBuilder;
    rpc(functionName: string, args: Record<string, unknown>): Promise<QueryResponse>;
}
```

Add guards for records, nonblank strings, safe integers, nullable strings/booleans, maybe-single responses, row arrays, nested theme names, and docs. Map malformed core responses to:

```ts
{
    kind: 'infrastructure',
    code: 'WORD_DETAIL_QUERY_FAILED',
    message: '단어 정보를 불러오는 중 오류가 발생했습니다.',
}
```

- [ ] **Step 5: Implement approved/pending selection and mapping**

Query exact `words` and `wait_words` rows first. Approved wins; an approved row plus delete request becomes `pending-deletion` with requester data from the wait row. A lone wait row becomes `pending-addition`. No rows returns `ok(null)`. Default nullable `k_canuse` to `true` and `noin_canuse` to `false`.

- [ ] **Step 6: Implement theme and docs mapping**

Approved rows load `word_themes` and `word_themes_wait`; pending additions load `wait_word_themes`. Remove every pending theme name from approved names, split pending themes by `add`/`delete`, then concatenate letter docs before theme docs without deduplication:

```ts
const pendingNames = pendingThemes.map(({ name }) => name);
const approved = approvedThemes.filter((name) => !pendingNames.includes(name));
const documents = [...letterDocuments, ...themeDocuments];
```

- [ ] **Step 7: Implement best-effort connection counts**

Use `word_last_letter_counts` plus exact-count pending words ending in `reverDuemLaw(firstLetter)` for `previousWordCount`. Use `word_first_letter_counts` plus exact-count pending words starting with the last letter or `DuemRaw(lastLetter)` for `nextWordCount`. If either subquery in one direction fails or is malformed, use `0` for that direction and keep the projection successful.

- [ ] **Step 8: Add branch and error tests**

Add independent tests for pending deletion metadata, pending addition defaults, no rows, core query error, malformed row, docs order/duplicates, theme exclusion, and per-direction count degradation.

- [ ] **Step 9: Run the adapter test**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts --runInBand`

Expected: PASS for every projection branch and error policy.

- [ ] **Step 10: Commit the projection adapter**

```bash
git add src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.ts src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts
git commit -m "feat: map supabase word detail projection"
```

---

### Task 3: Add Random Connected-Word Lookup and Composition

**Files:**
- Modify: `src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.ts`
- Modify: `src/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.ts`
- Test: `src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts`
- Test: `src/__tests__/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.test.ts`

**Interfaces:**
- Consumes: Task 1 input/service and Task 2 adapter.
- Produces: `findRandomConnectedWord` and `BrowserWordCatalogServices.wordDetailService`.

- [ ] **Step 1: Write failing approved-first/fallback tests**

Assert exact RPC calls:

```ts
// previous
['random_word_ff', { fir1: ['나', '라'] }]
['random_wait_word_ff', { prefixes: ['나', '라'] }]

// next
['random_word_ll', { fir1: ['비'] }]
['random_wait_word_ll', { prefixes: ['비'] }]
```

Cover approved result skipping pending RPC, pending fallback, both empty returning `ok(null)`, malformed result, and either RPC error.

- [ ] **Step 2: Run the adapter test and confirm random cases fail**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts --runInBand`

Expected: FAIL in the new random cases.

- [ ] **Step 3: Implement direction-to-RPC mapping**

```ts
const names = input.direction === 'previous'
    ? { approved: 'random_word_ff', pending: 'random_wait_word_ff' }
    : { approved: 'random_word_ll', pending: 'random_wait_word_ll' };
```

Parse only nonblank `{ word: string }` rows, return the first approved word, otherwise the first pending word, otherwise `null`. Use `WORD_DETAIL_QUERY_FAILED` for errors/malformed rows.

- [ ] **Step 4: Compose the detail service**

```ts
export interface BrowserWordCatalogServices {
    searchWordsService: SearchWordsService;
    wordDetailService: GetWordDetailService;
}

export const createBrowserWordCatalogServices = (): BrowserWordCatalogServices => ({
    searchWordsService: new SearchWordsService(new SupabaseWordCatalogQueryGateway()),
    wordDetailService: new GetWordDetailService(new SupabaseWordDetailQueryGateway()),
});
```

Update the composition test to assert both concrete Application services.

- [ ] **Step 5: Run both Infrastructure tests**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts src/__tests__/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit random lookup and composition**

```bash
git add src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.ts src/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.ts src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway.test.ts src/__tests__/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.test.ts
git commit -m "feat: add connected word query service"
```

---

### Task 4: Add React Query Hooks

**Files:**
- Create: `src/modules/word-catalog/presentation/use-word-detail.ts`
- Create: `src/modules/word-catalog/presentation/use-random-connected-word.ts`
- Modify: `src/modules/word-catalog/presentation/word-catalog-query-keys.ts`
- Modify: `src/modules/word-catalog/index.ts`
- Test: `src/__tests__/modules/word-catalog/presentation/use-word-detail.test.tsx`
- Test: `src/__tests__/modules/word-catalog/presentation/use-random-connected-word.test.tsx`

**Interfaces:**
- Consumes: `GetWordDetailService`, shared query result unwrap/retry helpers, and browser composition.
- Produces: `WordDetailService`, `useWordDetail`, `useRandomConnectedWord`, and `wordCatalogQueryKeys.detail`.

- [ ] **Step 1: Write failing detail hook tests**

Under a `QueryClientProvider`, inject a service mock and assert service input, returned DTO, `not-found` propagation without retry, infrastructure retry policy, and distinct cache entries. Fix the key shape:

```ts
expect(wordCatalogQueryKeys.detail('나비')).toEqual([
    'word-catalog', 'detail', '나비',
]);
```

- [ ] **Step 2: Run the detail hook test and verify failure**

Run: `npx jest src/__tests__/modules/word-catalog/presentation/use-word-detail.test.tsx --runInBand`

Expected: FAIL because the hook/key do not exist.

- [ ] **Step 3: Implement the detail key and hook**

```ts
detail: (word: string) => [...wordCatalogQueryKeys.all, 'detail', word] as const,
```

```ts
export type WordDetailService = Pick<GetWordDetailService, 'get' | 'findRandomConnectedWord'>;

/** 단어 상세 projection을 React Query 캐시와 연결한다. */
export const useWordDetail = (word: string, service?: WordDetailService) => {
    const normalizedWord = word.trim();
    const [resolvedService] = useState<WordDetailService>(() => (
        service ?? createBrowserWordCatalogServices().wordDetailService
    ));
    return useQuery<WordDetail, ApplicationError>({
        queryKey: wordCatalogQueryKeys.detail(normalizedWord),
        queryFn: () => unwrapWordCatalogQuery(() => resolvedService.get(normalizedWord)),
        enabled: normalizedWord.length > 0,
        retry: (failureCount, error) => error.kind !== 'not-found'
            && retryWordCatalogQuery(failureCount, error),
    });
};
```

- [ ] **Step 4: Write failing on-demand hook tests**

Call `mutateAsync` twice with identical input and assert the service runs twice. Add successful `null`, thrown ApplicationError, and deferred-promise `isPending` cases.

- [ ] **Step 5: Implement the random hook**

```ts
/** 사용자 연결 동작마다 임의 단어 조회를 새로 실행한다. */
export const useRandomConnectedWord = (service?: WordDetailService) => {
    const [resolvedService] = useState<WordDetailService>(() => (
        service ?? createBrowserWordCatalogServices().wordDetailService
    ));
    return useMutation<string | null, ApplicationError, FindRandomConnectedWordInput>({
        mutationFn: (input) => unwrapWordCatalogQuery(
            () => resolvedService.findRandomConnectedWord(input),
        ),
    });
};
```

- [ ] **Step 6: Export stable detail types/hooks from `index.ts`**

Export the DTO/input types, `useWordDetail`, `useRandomConnectedWord`, and `WordDetailService`. Do not export the Supabase adapter.

- [ ] **Step 7: Run all word-catalog module tests**

Run: `npx jest src/__tests__/modules/word-catalog --runInBand`

Expected: PASS.

- [ ] **Step 8: Commit the presentation boundary**

```bash
git add src/modules/word-catalog/presentation/use-word-detail.ts src/modules/word-catalog/presentation/use-random-connected-word.ts src/modules/word-catalog/presentation/word-catalog-query-keys.ts src/modules/word-catalog/index.ts src/__tests__/modules/word-catalog/presentation/use-word-detail.test.tsx src/__tests__/modules/word-catalog/presentation/use-random-connected-word.test.tsx
git commit -m "feat: expose word detail query hooks"
```

---

### Task 5: Connect the Page Without SCM

**Files:**
- Modify: `src/app/word/search/[query]/WordInfoPage.tsx`
- Modify: `src/app/word/search/[query]/WordInfo.tsx`
- Create: `src/__tests__/word/search/query/WordInfoPage.test.tsx`
- Modify: `src/__tests__/word/search/query/WordInfo.test.tsx`

**Interfaces:**
- Consumes: Task 4 hooks and DTO.
- Produces: SCM-free `WordInfoPage`; `WordInfoProps` with numeric counts and connection pending state.

- [ ] **Step 1: Change WordInfo test fixtures first**

Replace count callbacks with:

```ts
goFirstLetterWords: 4,
goLastLetterWords: 7,
isConnectionLoading: false,
```

Assert `(4)` and `(7)` render, then rerender with `isConnectionLoading: true` and assert both connection buttons are disabled.

- [ ] **Step 2: Run the component test and verify the prop failure**

Run: `npx jest src/__tests__/word/search/query/WordInfo.test.tsx --runInBand`

Expected: FAIL because the component still expects count callbacks.

- [ ] **Step 3: Replace count callbacks in WordInfo**

Change `WordInfoProps` to numeric `goFirstLetterWords`, numeric `goLastLetterWords`, and boolean `isConnectionLoading`. Remove local count states and their mount effect. Read counts directly and disable both connection buttons during random lookup, retaining `Loader2` as the visual pending indicator.

- [ ] **Step 4: Write failing WordInfoPage tests**

Mock the two hooks, axios, `next/navigation`, and the child component. Cover loading, not-found, infrastructure error, all three status mappings, themes/docs/count/mission/requester mapping, `refetch` through `reloadWordInfo`, successful/failed KkukoWiki checks, both navigation directions, random `null` fallback, and random ApplicationError.

- [ ] **Step 5: Run the page test and verify legacy failure**

Run: `npx jest src/__tests__/word/search/query/WordInfoPage.test.tsx --runInBand`

Expected: FAIL because the page still imports SCM.

- [ ] **Step 6: Replace page orchestration with hooks**

Remove `SCM`, `PostgrestError`, and `useLoadingState`. Use:

```tsx
const detailQuery = useWordDetail(query);
const connectedWord = useRandomConnectedWord();

if (detailQuery.error?.kind === 'not-found') return notFound();
if (detailQuery.isPending) return <LoadingPage title="단어 정보" />;
if (detailQuery.error) return <ErrorPage message={detailQuery.error.message} />;
```

Map status, themes, docs, counts, initials, length, requester data, and mission letters (`가나다라마바사아자차카타파하`) in a pure helper.

- [ ] **Step 7: Connect random navigation and refresh**

The two callbacks pass the candidate arrays already calculated by `WordInfo` and run:

```ts
const selectedWord = await connectedWord.mutateAsync({ direction, letters });
router.push(`/word/search/${selectedWord ?? detail.word}`);
```

Catch rejection to avoid an unhandled event promise and render the mutation's stable error. Pass `connectedWord.isPending`; implement `reloadWordInfo` as `void detailQuery.refetch()`.

- [ ] **Step 8: Preserve the KkukoWiki effect**

Keep `/api/get_kkukowiki?title=${detail.word}`, reset on word change, set the link only on HTTP 200 for approved projections, and ignore failures without changing query errors.

- [ ] **Step 9: Run page/component/mutation tests**

Run: `npx jest src/__tests__/word/search/query/WordInfoPage.test.tsx src/__tests__/word/search/query/WordInfo.test.tsx src/__tests__/word/search/query/use-word-info-mutations.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 10: Verify direct data access is gone**

Run: `git grep -n -E "SCM|PostgrestError|\.from\(|\.rpc\(" -- 'src/app/word/search/[query]/WordInfoPage.tsx'`

Expected: no output.

- [ ] **Step 11: Commit the page migration**

```bash
git add src/app/word/search/[query]/WordInfoPage.tsx src/app/word/search/[query]/WordInfo.tsx src/__tests__/word/search/query/WordInfoPage.test.tsx src/__tests__/word/search/query/WordInfo.test.tsx
git commit -m "refactor: migrate word detail queries"
```

---

### Task 6: Remove Legacy Getters, Update Roadmap, and Verify

**Files:**
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: completed query path from Tasks 1–5.
- Produces: no dead detail getters and a current roadmap.

- [ ] **Step 1: List remaining consumers**

Run:

```bash
git grep -n -E "\.(wordInfoByWord|waitWordInfoByWord|wordThemeByWordId|wordThemeWaitByWordId|waitWordThemes|letterDocsByWord|themeDocsByThemeNames|firstWordCountByLetters|lastWordCountByLetters|randomWordByFirstLetter|randomWordByLastLetter)\(" -- "src/**/*.ts" "src/**/*.tsx"
```

Expected: `wordInfoByWord` remains in `WordAddHome.tsx`; mutation-oriented `waitWordThemes` signatures may remain; the page no longer consumes the other getters.

- [ ] **Step 2: Remove only replaced getter signatures/implementations**

Remove `waitWordInfoByWord`, getter `waitWordThemes(wordId: number)`, `wordThemeByWordId`, `wordThemeWaitByWordId`, `letterDocsByWord`, `themeDocsByThemeNames`, both count getters, and both random getters. Keep `wordInfoByWord` and add/update mutation methods, including other `waitWordThemes` signatures.

- [ ] **Step 3: Run focused tests after cleanup**

Run: `npx jest src/__tests__/modules/word-catalog src/__tests__/word/search/query --runInBand`

Expected: PASS.

- [ ] **Step 4: Update the roadmap**

Mark Phase 3 word detail complete, name the advanced search Route Handler as the next slice, keep `word-catalog 조회` at `부분 완료`, reorder `당장 처리할 작업`, and record why `wordInfoByWord` remains.

- [ ] **Step 5: Run architecture grep checks**

Run each command separately:

```bash
git grep -n -E "SCM|@supabase/supabase-js|\.from\(|\.rpc\(" -- "src/app/word/search/[query]/WordInfoPage.tsx"
git grep -n -E "@supabase|database\.types|next/|react" -- "src/modules/word-catalog/application/*.ts"
git grep -n -E "randomWordByFirstLetter|randomWordByLastLetter|waitWordInfoByWord|wordThemeByWordId|wordThemeWaitByWordId|letterDocsByWord|themeDocsByThemeNames|firstWordCountByLetters|lastWordCountByLetters" -- "src/**/*.ts" "src/**/*.tsx"
```

Expected: no output from all three commands.

- [ ] **Step 6: Run ESLint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 7: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 8: Run all Jest tests**

Run: `npm run test -- --runInBand`

Expected: exit code 0. Report a pre-existing failure without editing unrelated tests.

- [ ] **Step 9: Check formatting and scope**

Run each command separately:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only planned files changed.

- [ ] **Step 10: Commit cleanup and roadmap status**

```bash
git add src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: retire legacy word detail queries"
```
