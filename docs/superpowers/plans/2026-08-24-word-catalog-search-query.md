# Word Catalog Search Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the browser word search, word suggestion, and search-theme queries from the global `SCM` facade into the first `word-catalog` DDD-lite vertical slice without changing their user-visible results.

**Architecture:** Add an Application query contract and service under `src/modules/word-catalog`, then implement it with a browser Supabase adapter that maps database responses to stable DTOs and `Result<T>`. Presentation hooks own React Query keys, caching, loading, and safe application errors; existing search components consume those hooks and no longer import `SCM` or generated database types.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, TanStack React Query 5, Supabase JS, Jest, Testing Library

**Spec:** `docs/superpowers/specs/2026-08-20-ddd-lite-data-access-refactoring-design.md` and `docs/architecture/ddd-lite-migration-roadmap.md` Phase 3

## Global Constraints

- Preserve current simple-search, autocomplete, advanced-search, and theme-selection results; do not change public routes or RPC signatures.
- Domain/Application code must not import React, Next.js, Supabase, or generated `database.types.ts`.
- Only Infrastructure may know table names, RPC names, response shapes, and generated DB types.
- Presentation must use the module's public Application/Presentation API and React Query for server-state caching.
- Do not retain the legacy two-second artificial delay in the new adapter.
- Remove each replaced `SCM` import immediately; remove `wordsByQuery` from the legacy manager after its final consumer is migrated.
- Keep `wordsByAdvancedQuery` and `allThemes` in the legacy manager while the advanced-search Route Handler and other contexts still use them.
- Do not manually edit `src/app/types/database.types.ts`.
- Add Korean JSDoc to the public query service, adapter, and presentation hooks.
- Run ESLint and `npx tsc --noEmit` after code changes, plus focused and full Jest tests.

---

### Task 1: Define and test the word-catalog Application query contract

**Files:**
- Create: `src/modules/word-catalog/application/word-search-types.ts`
- Create: `src/modules/word-catalog/application/word-search-ports.ts`
- Create: `src/modules/word-catalog/application/search-words.ts`
- Create: `src/__tests__/modules/word-catalog/application/search-words.test.ts`

**Interfaces:**
- Consumes: shared `Result<T>`, `ok`, `err`, and `ApplicationError`.
- Produces: `WordSearchMode`, `AdvancedWordSearchQuery`, `WordSearchRequest`, `WordSearchResult`, `WordThemeSummary`, `WordCatalogQueryGateway`, and `SearchWordsService`.

- [ ] **Step 1: Write failing service tests**

```ts
test('simple search trims and removes unsupported characters before querying', async () => {
    const gateway = createGateway({ suggestions: ['가나', '가나다'] });
    const service = new SearchWordsService(gateway);

    const result = await service.search({ type: 'simple', query: '  가!나  ' });

    expect(result).toEqual(ok([
        { word: '가나', nextWordCount: -1 },
        { word: '가나다', nextWordCount: -1 },
    ]));
    expect(gateway.suggestWords).toHaveBeenCalledWith('가나');
});

test('advanced search rejects a missing start letter without calling infrastructure', async () => {
    const gateway = createGateway();
    const service = new SearchWordsService(gateway);

    const result = await service.search({
        type: 'advanced',
        query: createKoreanStartQuery({ start: undefined }),
    });

    expect(result).toEqual(err({
        kind: 'validation',
        field: 'start',
        message: '시작 글자가 필요합니다.',
    }));
    expect(gateway.searchAdvanced).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the Application test and confirm RED**

Run: `npx jest src/__tests__/modules/word-catalog/application/search-words.test.ts --runInBand`

Expected: FAIL because `SearchWordsService` and the new contract files do not exist.

- [ ] **Step 3: Implement the minimal contract and service**

```ts
export type WordSearchRequest =
    | { type: 'simple'; query: string }
    | { type: 'advanced'; query: AdvancedWordSearchQuery };

export interface WordCatalogQueryGateway {
    suggestWords(query: string): Promise<Result<string[]>>;
    searchAdvanced(query: AdvancedWordSearchQuery): Promise<Result<WordSearchResult[]>>;
    listThemes(): Promise<Result<WordThemeSummary[]>>;
}

export class SearchWordsService {
    constructor(private readonly gateway: WordCatalogQueryGateway) {}

    async search(request: WordSearchRequest): Promise<Result<WordSearchResult[]>> {
        if (request.type === 'simple') {
            const query = sanitizeWordQuery(request.query);
            if (query.length === 0) {
                return err(validationError('query', '검색어가 필요합니다.'));
            }
            const result = await this.gateway.suggestWords(query);
            return result.ok
                ? ok(result.value.map((word) => ({ word, nextWordCount: -1 })))
                : result;
        }

        const validation = validateAdvancedWordSearchQuery(request.query);
        return validation.ok
            ? this.gateway.searchAdvanced(validation.value)
            : validation;
    }

    suggest(query: string): Promise<Result<string[]>>;
    listThemes(): Promise<Result<WordThemeSummary[]>>;
}
```

Implement literal validation for every discriminated mode: required `start`/`end`, three-letter `kung` bounds, two-character `hunmin` query, required positive `jaqi.themeId`, finite integer lengths, and a display limit clamped to the existing default of 100 when invalid.

- [ ] **Step 4: Run the Application test and confirm GREEN**

Run: `npx jest src/__tests__/modules/word-catalog/application/search-words.test.ts --runInBand`

Expected: PASS with simple normalization, all mode validation branches, gateway error propagation, and DTO mapping covered.

- [ ] **Step 5: Commit the Application contract**

```bash
git add src/modules/word-catalog/application src/__tests__/modules/word-catalog/application
git commit -m "feat: define word catalog search queries"
```

### Task 2: Implement and test the browser Supabase query adapter

**Files:**
- Create: `src/modules/word-catalog/infrastructure/browser/supabase-word-catalog-query-gateway.ts`
- Create: `src/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.ts`
- Create: `src/__tests__/modules/word-catalog/infrastructure/browser/supabase-word-catalog-query-gateway.test.ts`
- Create: `src/__tests__/modules/word-catalog/infrastructure/browser/browser-word-catalog-services.test.ts`

**Interfaces:**
- Consumes: `WordCatalogQueryGateway`, `AdvancedWordSearchQuery`, `WordSearchResult`, `WordThemeSummary`, `browserSupabaseClient`, and shared `Result<T>`.
- Produces: `SupabaseWordCatalogQueryGateway` and `createBrowserWordCatalogServices(): { searchWordsService: SearchWordsService }`.

- [ ] **Step 1: Write failing adapter tests**

```ts
test('suggestWords merges approved and pending words without duplicates and sorts by length', async () => {
    const client = createQueryClient({
        words: [{ word: '가나다' }, { word: '가나' }],
        waitWords: [{ word: '가나' }, { word: '가나다라' }],
    });
    const gateway = new SupabaseWordCatalogQueryGateway(client);

    await expect(gateway.suggestWords('가')).resolves.toEqual(
        ok(['가나', '가나다', '가나다라']),
    );
});

test('maps a Korean start RPC result to the matching next-word count projection', async () => {
    const client = createQueryClient({
        firstLetterCounts: [{ first_letter: '다', k_count: 7, n_count: 3, len3_k_count: 2, len3_n_count: 1 }],
        lastLetterCounts: [],
        rpcWords: [{ word: '가나다' }],
    });
    const gateway = new SupabaseWordCatalogQueryGateway(client);

    const result = await gateway.searchAdvanced(createKoreanStartQuery());

    expect(result).toEqual(ok([{ word: '가나다', nextWordCount: 7 }]));
});
```

Add separate literal fixtures for `kor-end`, `kung`, `hunmin`, `jaqi`, theme mapping, Supabase errors, thrown client failures, and malformed response rows.

- [ ] **Step 2: Run the adapter tests and confirm RED**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser --runInBand`

Expected: FAIL because the gateway and browser composition root do not exist.

- [ ] **Step 3: Implement the minimal adapter and composition root**

```ts
/** 브라우저 Supabase 조회 결과를 word-catalog DTO로 변환한다. */
export class SupabaseWordCatalogQueryGateway implements WordCatalogQueryGateway {
    constructor(private readonly client: WordCatalogQueryClient = browserSupabaseClient) {}

    async suggestWords(query: string): Promise<Result<string[]>>;
    async searchAdvanced(query: AdvancedWordSearchQuery): Promise<Result<WordSearchResult[]>>;
    async listThemes(): Promise<Result<WordThemeSummary[]>>;
}

export const createBrowserWordCatalogServices = (): BrowserWordCatalogServices => ({
    searchWordsService: new SearchWordsService(new SupabaseWordCatalogQueryGateway()),
});
```

The adapter must preserve the current RPC argument names and result ordering, convert every unknown row through narrow runtime guards, return a stable Korean infrastructure error, and omit the legacy artificial delay and manager memory cache.

- [ ] **Step 4: Run the adapter tests and confirm GREEN**

Run: `npx jest src/__tests__/modules/word-catalog/infrastructure/browser --runInBand`

Expected: PASS for all modes, mapping, ordering, deduplication, RPC payloads, and failure shapes.

- [ ] **Step 5: Commit the browser adapter**

```bash
git add src/modules/word-catalog/infrastructure src/__tests__/modules/word-catalog/infrastructure
git commit -m "feat: add word catalog browser queries"
```

### Task 3: Add React Query presentation hooks and migrate browser consumers

**Files:**
- Create: `src/modules/word-catalog/presentation/word-catalog-query-keys.ts`
- Create: `src/modules/word-catalog/presentation/use-word-catalog-search.ts`
- Create: `src/modules/word-catalog/presentation/use-word-suggestions.ts`
- Create: `src/modules/word-catalog/presentation/use-word-themes.ts`
- Create: `src/modules/word-catalog/index.ts`
- Create: `src/__tests__/modules/word-catalog/presentation/use-word-catalog-search.test.tsx`
- Create: `src/__tests__/modules/word-catalog/presentation/use-word-suggestions.test.tsx`
- Create: `src/__tests__/modules/word-catalog/presentation/use-word-themes.test.tsx`
- Modify: `src/app/word/search/hooks/useWordSearch.ts`
- Modify: `src/app/word/search/WordSearch.tsx`
- Modify: `src/app/word/search/[query]/SearchBar.tsx`
- Modify: `src/app/word/search/components/ThemeSelectionModal.tsx`
- Modify: `src/app/word/search/types.ts`
- Test: `src/__tests__/word/search/useWordSearch.test.tsx`

**Interfaces:**
- Consumes: `SearchWordsService`, `WordSearchRequest`, `WordSearchResult`, `WordThemeSummary`, and `createBrowserWordCatalogServices`.
- Produces: stable `wordCatalogQueryKeys`, `useWordCatalogSearch(request)`, `useWordSuggestions(query)`, `useWordThemes(isEnabled)`, and a legacy-free `useWordSearch` view-state hook.

- [ ] **Step 1: Write failing presentation tests**

```tsx
test('search hook caches results by the normalized request key', async () => {
    const service = createService(ok([{ word: '가나', nextWordCount: -1 }]));
    const { result, rerender } = renderHook(
        ({ request }) => useWordCatalogSearch(request, service),
        { wrapper: createQueryWrapper(), initialProps: { request: { type: 'simple', query: '가' } } },
    );

    await waitFor(() => expect(result.current.data).toEqual([{ word: '가나', nextWordCount: -1 }]));
    rerender({ request: { type: 'simple', query: '가' } });
    expect(service.search).toHaveBeenCalledTimes(1);
});

test('theme hook does not query while the modal is closed', () => {
    const service = createService(ok([]));
    renderHook(() => useWordThemes(false, service), { wrapper: createQueryWrapper() });
    expect(service.listThemes).not.toHaveBeenCalled();
});
```

Add tests that application failures become typed hook errors, empty suggestion input disables the query, `useWordSearch` submits simple and advanced requests, and clearing/changing modes clears the committed result request.

- [ ] **Step 2: Run the presentation tests and confirm RED**

Run: `npx jest src/__tests__/modules/word-catalog/presentation src/__tests__/word/search/useWordSearch.test.tsx --runInBand`

Expected: FAIL because the hooks and migrated view-state API do not exist.

- [ ] **Step 3: Implement the React Query hooks and public module API**

```ts
export const wordCatalogQueryKeys = {
    all: ['word-catalog'] as const,
    search: (request: WordSearchRequest) => [...wordCatalogQueryKeys.all, 'search', request] as const,
    suggestions: (query: string) => [...wordCatalogQueryKeys.all, 'suggestions', query] as const,
    themes: () => [...wordCatalogQueryKeys.all, 'themes'] as const,
};
```

Each query function unwraps `Result<T>` and throws only the stable `ApplicationError`; retries are disabled for validation errors. The public `index.ts` exports Application DTOs and presentation hooks but does not export the Supabase adapter.

- [ ] **Step 4: Migrate the search components**

Replace direct `SCM` and SWR access with the module hooks. Keep the existing submit-driven search interaction, empty-result display, loading indicator, links, and theme grouping. Replace generated `Theme` and local `SearchResult` database-aware types with `WordThemeSummary` and `WordSearchResult`.

- [ ] **Step 5: Run presentation and existing word-search tests and confirm GREEN**

Run: `npx jest src/__tests__/modules/word-catalog/presentation src/__tests__/word/search --runInBand`

Expected: PASS with no direct Supabase or legacy manager dependency in the migrated browser search files.

- [ ] **Step 6: Commit the presentation migration**

```bash
git add src/modules/word-catalog src/app/word/search src/__tests__/modules/word-catalog/presentation src/__tests__/word/search
git commit -m "refactor: migrate browser word search queries"
```

### Task 4: Remove replaced legacy query code, document progress, and verify

**Files:**
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: the completed word-catalog browser query slice.
- Produces: no `wordsByQuery` method or browser search `SCM` imports; roadmap status accurately records the first Phase 3 slice as complete while Route Handler and detail work remain.

- [ ] **Step 1: Confirm remaining legacy consumers**

Run: `git grep -n -E "wordsByQuery|wordsByAdvancedQuery|allThemes|import .*SCM" -- src/app/word/search src/app/api/words/search src/app/lib/supabase`

Expected: `wordsByQuery` has no consumers; `wordsByAdvancedQuery` remains in `api/words/search/route.ts`; `allThemes` remains for other legacy contexts.

- [ ] **Step 2: Remove only the fully replaced legacy method**

Delete `wordsByQuery` from `IGetManager` and `SupabaseClientManager`. Do not remove `wordsByAdvancedQuery`, `allThemes`, `letterCountInfo`, or their cache fields because remaining legacy consumers still require them.

- [ ] **Step 3: Update the roadmap**

Record that Phase 3 search and autocomplete browser queries are complete, list the migrated files, state that `word-catalog` is now `부분 완료`, and identify word detail plus the advanced-search Route Handler as the next slice.

- [ ] **Step 4: Run focused architecture and test checks**

```bash
git grep -n -E "SCM|@supabase/supabase-js|database\.types|\.from\(|\.rpc\(" -- src/app/word/search src/modules/word-catalog/application src/modules/word-catalog/presentation
npx jest src/__tests__/modules/word-catalog src/__tests__/word/search --runInBand
```

Expected: grep returns no forbidden dependency in Application/Presentation or migrated browser files; focused tests pass.

- [ ] **Step 5: Run required repository verification**

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
git diff --check
```

Expected: every command exits 0; all Jest suites pass. Existing non-failing console warnings are reported separately.

- [ ] **Step 6: Commit cleanup and documentation**

```bash
git add src/app/lib/supabase docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: retire legacy word suggestion query"
```

