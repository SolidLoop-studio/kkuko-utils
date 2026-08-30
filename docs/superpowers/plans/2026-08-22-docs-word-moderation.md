# Docs Word Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five administrator mutations in `words-docs/[id]` with identifier-based DDD-lite services and atomic RPCs while preserving the three legacy user request actions.

**Architecture:** Enrich docs rows through a feature query with stable mutation targets, reuse the existing `approve_word_requests` and `reject_word_requests` transaction RPCs, and add one `admin`-only `delete_word_directly` RPC. Presentation calls a composed feature hook, updates rows locally after success, and never assembles Supabase queries or multi-step mutations.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, React Query 5, Redux Toolkit, Supabase/PostgreSQL, Jest 30, Testing Library, pgTAP

**Spec:** `docs/superpowers/specs/2026-08-22-docs-word-moderation-design.md`

## Global Constraints

- Keep administrator buttons visible only when `user.role === 'admin'`; do not expose them to `r4` in the docs UI.
- Reuse `approve_word_requests` and `reject_word_requests`; do not create a docs-specific request moderation RPC.
- `delete_word_directly` must re-check `auth.uid()` and require the exact DB role `admin`.
- Do not preserve the duplicate theme docs-log bug or the theme-change no-op bug.
- Keep `RequestDelete`, `CancelAddRequest`, and `CancelDeleteRequest` on their current legacy behavior for this slice.
- Do not add a new `SCM` method, place Supabase/DB types in Domain or Application, or edit `src/app/types/database.types.ts` manually.
- Use the project Modal components; do not use `alert` or `confirm`.
- Apply DB changes only through forward migration `supabase/migrations/20260822120000_direct_word_deletion.sql`.
- Run local DB commands without `--linked`, and stop local Supabase at the end even after a failure.
- Preserve unrelated worktree changes and remove only legacy SCM methods proven unused after this migration.

---

## File Structure

### New feature files

- `src/modules/word-moderation/domain/docs-word-moderation.ts` — validates docs target queries and direct-delete commands, and converts a target to an existing moderation command.
- `src/modules/word-moderation/application/docs-word-moderation-types.ts` — target, query, and direct-delete DTOs.
- `src/modules/word-moderation/application/docs-word-moderation-ports.ts` — small target-query and direct-delete gateway contracts.
- `src/modules/word-moderation/application/get-docs-word-mutation-targets.ts` — target-query use case.
- `src/modules/word-moderation/application/delete-word-directly.ts` — direct-delete use case.
- `src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts` — RLS read queries and direct-delete RPC adapter.
- `src/modules/word-moderation/presentation/use-docs-word-moderation.ts` — React Query mutation facade combining existing request moderation and direct deletion.
- `src/app/words-docs/[id]/docs-word-data.ts` — feature-specific row type carrying a nullable stable mutation target.
- `src/app/words-docs/[id]/use-user-word-request-actions.ts` — the three untouched legacy user actions extracted from `TableWorkFunc.tsx`.

### New tests and DB artifacts

- `src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts`
- `src/__tests__/modules/word-moderation/application/get-docs-word-mutation-targets.test.ts`
- `src/__tests__/modules/word-moderation/application/delete-word-directly.test.ts`
- `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts`
- `src/__tests__/modules/word-moderation/presentation/use-docs-word-moderation.test.tsx`
- `src/__tests__/words-docs/id/Table.test.tsx`
- `src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx`
- `supabase/migrations/20260822120000_direct_word_deletion.sql`
- `supabase/tests/database/direct-word-deletion.integration.sql`
- `supabase/tests/database/direct-word-deletion-concurrency.integration.sql`
- `docs/testing/direct-word-deletion-rpc-integration.md`

### Existing files modified

- `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- `src/modules/word-moderation/index.ts`
- `src/app/words-docs/[id]/DocsDataPage.tsx`
- `src/app/words-docs/[id]/DocsDataHome.tsx`
- `src/app/words-docs/[id]/WordsTableBody.tsx`
- `src/app/words-docs/[id]/Table.tsx`
- `src/app/words-docs/[id]/WorkModal.tsx`
- `src/app/words-docs/[id]/TableWorkFunc.tsx` — delete after user actions move and all imports disappear.
- `src/app/lib/supabase/ISupabaseClientManager.ts`
- `src/app/lib/supabase/SupabaseClientManager.ts`
- `package.json`
- `docs/architecture/ddd-lite-migration-roadmap.md`

---

### Task 1: Domain and Application Contracts

**Files:**
- Create: `src/modules/word-moderation/domain/docs-word-moderation.ts`
- Create: `src/modules/word-moderation/application/docs-word-moderation-types.ts`
- Create: `src/modules/word-moderation/application/docs-word-moderation-ports.ts`
- Create: `src/modules/word-moderation/application/get-docs-word-mutation-targets.ts`
- Create: `src/modules/word-moderation/application/delete-word-directly.ts`
- Test: `src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts`
- Test: `src/__tests__/modules/word-moderation/application/get-docs-word-mutation-targets.test.ts`
- Test: `src/__tests__/modules/word-moderation/application/delete-word-directly.test.ts`

**Interfaces:**
- Consumes: `Result<T>`, `ModerateWordRequestsCommand`, and `WordRequestModerationSelection` from the existing shared/Application contracts.
- Produces: `DocsWordMutationTarget`, `GetDocsWordMutationTargetsQuery`, `GetDocsWordMutationTargetsResult`, `DeleteWordDirectlyCommand`, `DeleteWordDirectlyResult`, `DocsWordMutationTargetGateway`, `DirectWordDeletionGateway`, `GetDocsWordMutationTargetsService`, `DeleteWordDirectlyService`, `normalizeDocsWordMutationTargetsQuery`, `normalizeDeleteWordDirectlyCommand`, and `toModerateWordRequestsCommand`.

- [ ] **Step 1: Write failing Domain tests for exact target validation and command mapping**

```ts
const wordRequestTarget = {
    kind: 'word-request' as const,
    requestId: 7,
    requestType: 'add' as const,
    selectedThemeIds: [9, 3, 9],
};

expect(toModerateWordRequestsCommand(wordRequestTarget)).toEqual(ok({
    selections: [{ kind: 'word-request', requestId: 7, selectedThemeIds: [3, 9] }],
}));

expect(toModerateWordRequestsCommand({
    kind: 'theme-change',
    wordId: 11,
    themeId: 13,
    type: 'delete',
})).toEqual(ok({
    selections: [{
        kind: 'theme-change',
        wordId: 11,
        changes: [{ themeId: 13, type: 'delete' }],
    }],
}));

expect(normalizeDeleteWordDirectlyCommand({ wordId: 0 })).toMatchObject({
    ok: false,
    error: { kind: 'validation', field: 'wordId' },
});
```

Also assert that a registered-word target cannot be converted to a request-moderation command, query `docsId` must be a positive safe integer, row words must be non-empty without surrounding whitespace, and statuses outside `add|delete|ok` are rejected.

- [ ] **Step 2: Run the Domain test and verify the missing module failure**

Run: `npx jest src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts --runInBand`

Expected: FAIL because `docs-word-moderation.ts` and its exports do not exist.

- [ ] **Step 3: Define the DTOs and pure Domain functions**

```ts
export type DocsWordMutationTarget =
    | { kind: 'word-request'; requestId: number; requestType: 'add' | 'delete'; selectedThemeIds: number[] }
    | { kind: 'theme-change'; wordId: number; themeId: number; type: 'add' | 'delete' }
    | { kind: 'registered-word'; wordId: number };

export type DocsWordMutationTargetRow = {
    word: string;
    status: 'add' | 'delete' | 'ok';
};

export type GetDocsWordMutationTargetsQuery = {
    docsId: number;
    rows: DocsWordMutationTargetRow[];
};

export type GetDocsWordMutationTargetsResult = {
    targets: Array<DocsWordMutationTarget | null>;
};

export type DeleteWordDirectlyCommand = { wordId: number };
export type DeleteWordDirectlyResult = {
    deletedWordCount: 1;
    affectedDocsIds: number[];
};
```

Implement positive-safe-integer checks, stable theme-ID deduplication/sorting, complete shape validation, and return `Result` validation errors with exact `field` values. `toModerateWordRequestsCommand` must return the existing command shape and reject `registered-word` with `field: 'target'`.

- [ ] **Step 4: Run the Domain tests and verify they pass**

Run: `npx jest src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Write failing Application service tests with small fakes**

```ts
class FakeTargetGateway implements DocsWordMutationTargetGateway {
    calls: GetDocsWordMutationTargetsQuery[] = [];
    result: Result<GetDocsWordMutationTargetsResult> = ok({ targets: [] });

    async getTargets(query: GetDocsWordMutationTargetsQuery) {
        this.calls.push(query);
        return this.result;
    }
}

class FakeDirectDeletionGateway implements DirectWordDeletionGateway {
    calls: DeleteWordDirectlyCommand[] = [];
    result: Result<DeleteWordDirectlyResult> = ok({
        deletedWordCount: 1,
        affectedDocsIds: [2, 4],
    });

    async deleteWord(command: DeleteWordDirectlyCommand) {
        this.calls.push(command);
        return this.result;
    }
}
```

Assert validation prevents gateway calls, normalized queries reach `getTargets`, normalized IDs reach `deleteWord`, and gateway `conflict`, `forbidden`, and `infrastructure` results are returned unchanged.

- [ ] **Step 6: Run the Application tests and verify the missing service failure**

Run: `npx jest src/__tests__/modules/word-moderation/application/get-docs-word-mutation-targets.test.ts src/__tests__/modules/word-moderation/application/delete-word-directly.test.ts --runInBand`

Expected: FAIL because the ports and services do not exist.

- [ ] **Step 7: Implement the small ports and services**

```ts
export interface DocsWordMutationTargetGateway {
    getTargets(
        query: GetDocsWordMutationTargetsQuery,
    ): Promise<Result<GetDocsWordMutationTargetsResult>>;
}

export interface DirectWordDeletionGateway {
    deleteWord(
        command: DeleteWordDirectlyCommand,
    ): Promise<Result<DeleteWordDirectlyResult>>;
}

export class GetDocsWordMutationTargetsService {
    constructor(private readonly gateway: DocsWordMutationTargetGateway) {}

    async get(query: GetDocsWordMutationTargetsQuery) {
        const normalized = normalizeDocsWordMutationTargetsQuery(query);
        return normalized.ok ? this.gateway.getTargets(normalized.value) : normalized;
    }
}

export class DeleteWordDirectlyService {
    constructor(private readonly gateway: DirectWordDeletionGateway) {}

    async execute(command: DeleteWordDirectlyCommand) {
        const normalized = normalizeDeleteWordDirectlyCommand(command);
        return normalized.ok ? this.gateway.deleteWord(normalized.value) : normalized;
    }
}
```

- [ ] **Step 8: Run all Task 1 tests**

Run: `npx jest src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts src/__tests__/modules/word-moderation/application/get-docs-word-mutation-targets.test.ts src/__tests__/modules/word-moderation/application/delete-word-directly.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/modules/word-moderation/domain/docs-word-moderation.ts src/modules/word-moderation/application/docs-word-moderation-types.ts src/modules/word-moderation/application/docs-word-moderation-ports.ts src/modules/word-moderation/application/get-docs-word-mutation-targets.ts src/modules/word-moderation/application/delete-word-directly.ts src/__tests__/modules/word-moderation/domain/docs-word-moderation.test.ts src/__tests__/modules/word-moderation/application/get-docs-word-mutation-targets.test.ts src/__tests__/modules/word-moderation/application/delete-word-directly.test.ts
git commit -m "feat: define docs word moderation contracts"
```

---

### Task 2: Stable Mutation Target Query Adapter

**Files:**
- Create: `src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts`
- Test: `src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts`

**Interfaces:**
- Consumes: `DocsWordMutationTargetGateway`, `GetDocsWordMutationTargetsQuery`, and `GetDocsWordMutationTargetsResult` from Task 1.
- Produces: `SupabaseDocsWordModerationGateway.getTargets(query)` and `BrowserWordModerationServices.docsWordMutationTargetService`.

- [ ] **Step 1: Write failing adapter tests for the three target variants**

Use an injected Supabase-like client and assert these authoritative mappings:

```ts
const query = {
    docsId: 44,
    rows: [
        { word: '가방', status: 'add' as const },
        { word: '나비', status: 'delete' as const },
        { word: '다람쥐', status: 'ok' as const },
    ],
};

await expect(gateway.getTargets(query)).resolves.toEqual(ok({
    targets: [
        {
            kind: 'word-request',
            requestId: 7,
            requestType: 'add',
            selectedThemeIds: [3, 9],
        },
        {
            kind: 'theme-change',
            wordId: 11,
            themeId: 13,
            type: 'delete',
        },
        { kind: 'registered-word', wordId: 17 },
    ],
}));
```

Cover duplicate whole-word candidates, missing IDs, mismatched status/type, malformed joins, and query rejection. These cases must return a safe `conflict` or `infrastructure` result and never expose raw PostgREST messages.

- [ ] **Step 2: Run the adapter test and verify it fails**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts --runInBand`

Expected: FAIL because `SupabaseDocsWordModerationGateway` does not exist.

- [ ] **Step 3: Implement chunked authoritative reads and deterministic mapping**

Use a fixed internal chunk size of 100 words. For every chunk, read:

```ts
wait_words: id, word, request_type, wait_word_themes(theme_id)
words: id, word
```

When the current docs row has `typez = 'theme'`, resolve its theme by the docs name and read:

```ts
word_themes_wait: word_id, theme_id, typez, words!inner(word)
```

Build arrays by input index, not by a `word`-only React key. Apply this exact precedence:

1. `status === 'ok'` requires one registered word and produces `registered-word`.
2. Pending rows first require exactly one matching `wait_words` row with the same request type and produce `word-request`.
3. If no whole-word request exists, a theme docs row requires exactly one matching `word_themes_wait` row and produces `theme-change`.
4. Missing or ambiguous targets produce `null`; transport or malformed-response failures return `err({ kind: 'infrastructure', message: '문서 단어 작업 정보를 불러오는 중 오류가 발생했습니다.' })`.

Sort and deduplicate `selectedThemeIds`. Do not return generated DB Row types from the class.

- [ ] **Step 4: Run the adapter tests and verify they pass**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Add the target service to the browser composition root and public module exports**

```ts
export interface BrowserWordModerationServices {
    wordApprovalService: RunWordApprovalService;
    wordDeletionService: RunWordDeletionService;
    wordRequestModerationService: ModerateWordRequestsService;
    docsWordMutationTargetService: GetDocsWordMutationTargetsService;
}
```

Construct `SupabaseDocsWordModerationGateway` once inside `createBrowserWordModerationServices()` and inject it into `GetDocsWordMutationTargetsService`. Export Task 1 DTOs/services from `src/modules/word-moderation/index.ts`.

- [ ] **Step 6: Extend the composition-root test**

Assert repeated calls return the same `docsWordMutationTargetService`, and that missing IndexedDB still affects only the existing resumable job services according to their current test contract.

- [ ] **Step 7: Run Task 2 tests**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts
git commit -m "feat: resolve docs word mutation targets"
```

---

### Task 3: Atomic Direct Word Deletion RPC

**Files:**
- Create: `supabase/tests/database/direct-word-deletion.integration.sql`
- Create: `supabase/tests/database/direct-word-deletion-concurrency.integration.sql`
- Create: `supabase/migrations/20260822120000_direct_word_deletion.sql`
- Create: `docs/testing/direct-word-deletion-rpc-integration.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `users`, `words`, `word_themes`, `wait_words`, `word_themes_wait`, `logs`, `docs`, `docs_logs`, `increment_contribution`, `update_last_updates`, and `words_docs_logs_trg` behavior.
- Produces: `public.delete_word_directly(p_word_id bigint) returns jsonb` with `DIRECT_WORD_DELETION_*` public errors and `{ deletedWordCount: 1, affectedDocsIds: number[] }`.

- [ ] **Step 1: Add the DB test script and write the failing integration test**

Add this exact script:

```json
"test:direct-word-deletion-db": "supabase test db --local supabase/tests/database/direct-word-deletion.integration.sql supabase/tests/database/direct-word-deletion-concurrency.integration.sql"
```

The pgTAP integration test must begin a transaction, create isolated admin/`r4`/regular-user/auth fixtures plus letter/theme/reference docs, and assert:

```sql
select throws_ok(
    $$select public.delete_word_directly(1)$$,
    'P0001',
    'DIRECT_WORD_DELETION_UNAUTHORIZED',
    'anonymous direct deletion is rejected'
);

set local role authenticated;
select is(
    public.delete_word_directly(
        (select id from public.words where word = 'direct-delete-fixture')
    ),
    '{"affectedDocsIds":[942001,942002],"deletedWordCount":1}'::jsonb,
    'admin direct deletion returns authoritative sorted docs IDs'
);
reset role;
```

Use `request.jwt.claim.sub` to switch authenticated actors. Assert regular and `r4` actors receive `DIRECT_WORD_DELETION_FORBIDDEN`; invalid IDs receive `DIRECT_WORD_DELETION_INVALID_INPUT`; stale IDs receive `DIRECT_WORD_DELETION_CONFLICT`; exact word/docs logs, timestamps, contribution, trigger-owned special logs, FK cascades, and forced-log-trigger rollback all match the spec. End with `select * from finish(); rollback;`.

- [ ] **Step 2: Start local Supabase, run the DB test, and verify the missing-function failure**

Run:

```bash
supabase start
npm run test:direct-word-deletion-db
```

Expected: FAIL because `public.delete_word_directly(bigint)` does not exist. Keep the local stack running only for the remaining Task 3 DB steps.

- [ ] **Step 3: Implement the forward migration**

Create private helpers only when they remove repeated validation inside this migration. The public function must use this exact security shell:

```sql
create or replace function public.delete_word_directly(p_word_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
    actor uuid;
    word_row public.words%rowtype;
    affected_docs_ids bigint[] := array[]::bigint[];
    direct_docs_ids bigint[] := array[]::bigint[];
    deleted_count integer;
    special_docs_ids constant bigint[] := array[
        201, 202,
        209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219,
        220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
        230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
        240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
        250, 251, 252
    ]::bigint[];
begin
    actor := auth.uid();
    if actor is null then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_UNAUTHORIZED';
    end if;
    if p_word_id is null or p_word_id <= 0 then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INVALID_INPUT';
    end if;
    if not exists (
        select 1 from public.users as app_user
        where app_user.id = actor and app_user.role = 'admin'
    ) then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_FORBIDDEN';
    end if;

    select * into word_row
    from public.words as target
    where target.id = p_word_id
    for update;
    if not found then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_CONFLICT';
    end if;

    perform word_theme.word_id
    from public.word_themes as word_theme
    where word_theme.word_id = word_row.id
    order by word_theme.word_id, word_theme.theme_id
    for update of word_theme;

    perform wait_word.id
    from public.wait_words as wait_word
    where wait_word.word_id = word_row.id
    order by wait_word.id
    for update;

    perform wait_theme.word_id
    from public.word_themes_wait as wait_theme
    where wait_theme.word_id = word_row.id
    order by wait_theme.word_id, wait_theme.theme_id, wait_theme.typez
    for update of wait_theme;

    select coalesce(
        pg_catalog.array_agg(document.id order by document.id),
        array[]::bigint[]
    ) into direct_docs_ids
    from public.docs as document
    where document.id <> all(special_docs_ids)
      and (
        (
            document.typez = 'letter'
            and pg_catalog.btrim(document.name) =
                pg_catalog.right(word_row.word, 1)
        )
        or (
            document.typez = 'theme'
            and exists (
                select 1
                from public.word_themes as word_theme
                join public.themes as theme
                  on theme.id = word_theme.theme_id
                where word_theme.word_id = word_row.id
                  and theme.name = document.name
            )
        )
      );

    perform document.id
    from public.docs as document
    where document.id = any(direct_docs_ids)
       or document.id = any(special_docs_ids)
    order by document.id
    for update;

    perform app_user.id
    from public.users as app_user
    where app_user.id = actor
    for update;

    insert into public.logs (
        word, make_by, processed_by, r_type, state
    ) values (
        word_row.word, actor, actor, 'delete', 'approved'
    );

    insert into public.docs_logs (docs_id, word, add_by, type)
    select direct_doc.id, word_row.word, actor, 'delete'
    from pg_catalog.unnest(direct_docs_ids) as direct_doc(id)
    order by direct_doc.id;

    if pg_catalog.cardinality(direct_docs_ids) > 0 then
        perform public.update_last_updates(docs_ids => direct_docs_ids);
    end if;
    perform public.increment_contribution(
        target_id => actor,
        inc_amount => 1
    );

    delete from public.words as target
    where target.id = word_row.id;
    get diagnostics deleted_count = row_count;
    if deleted_count <> 1 then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
    end if;

    affected_docs_ids := direct_docs_ids;

    return pg_catalog.jsonb_build_object(
        'deletedWordCount', 1,
        'affectedDocsIds', pg_catalog.to_jsonb(affected_docs_ids)
    );
exception
    when raise_exception then
        if sqlerrm in (
            'DIRECT_WORD_DELETION_UNAUTHORIZED',
            'DIRECT_WORD_DELETION_FORBIDDEN',
            'DIRECT_WORD_DELETION_INVALID_INPUT',
            'DIRECT_WORD_DELETION_CONFLICT',
            'DIRECT_WORD_DELETION_INTERNAL_ERROR'
        ) then
            raise;
        end if;
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
    when others then
        raise exception using errcode = 'P0001',
            message = 'DIRECT_WORD_DELETION_INTERNAL_ERROR';
end;
$function$;

revoke all on function public.delete_word_directly(bigint) from public, anon;
grant execute on function public.delete_word_directly(bigint)
    to authenticated, service_role;
```

Keep the SQL statements in this order so every side effect occurs after preflight validation and all manually inserted docs logs exclude the complete `special_docs_ids` constant shown above.

- [ ] **Step 4: Apply only the new local migration and run the integration test**

Run:

```bash
supabase migration up --local
npm run test:direct-word-deletion-db
```

Expected: the behavior test passes; the concurrency file may still fail until Step 5.

- [ ] **Step 5: Write the deterministic concurrency test**

Use the existing `dblink` pattern from `word-request-moderation-concurrency.integration.sql`: start two authenticated admin sessions targeting the same `wordId`, hold the first transaction after locking, release it, and assert exactly one result succeeds while the other returns `DIRECT_WORD_DELETION_CONFLICT`. Assert one word log, one contribution increment, one set of direct docs logs, and no remaining word/request rows.

- [ ] **Step 6: Run both DB tests and verify they pass**

Run: `npm run test:direct-word-deletion-db`

Expected: PASS for behavior and concurrency files.

- [ ] **Step 7: Document the local-only execution lifecycle**

In `docs/testing/direct-word-deletion-rpc-integration.md`, record:

```bash
supabase start
supabase migration up --local
npm run test:direct-word-deletion-db
supabase stop
```

State that `--linked` and remote projects are forbidden for this test, and that `supabase stop` runs after both success and failure.

- [ ] **Step 8: Stop local Supabase**

Run: `supabase stop`

Expected: local services stop cleanly.

- [ ] **Step 9: Commit Task 3**

```bash
git add package.json supabase/migrations/20260822120000_direct_word_deletion.sql supabase/tests/database/direct-word-deletion.integration.sql supabase/tests/database/direct-word-deletion-concurrency.integration.sql docs/testing/direct-word-deletion-rpc-integration.md
git commit -m "feat: add atomic direct word deletion"
```

---

### Task 4: Direct Deletion Browser Gateway and Composition

**Files:**
- Modify: `src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts`
- Modify: `src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts`
- Modify: `src/modules/word-moderation/index.ts`
- Modify: `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts`
- Modify: `src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts`

**Interfaces:**
- Consumes: `DirectWordDeletionGateway`, `DeleteWordDirectlyCommand`, `DeleteWordDirectlyResult`, and `DeleteWordDirectlyService` from Task 1; `public.delete_word_directly(bigint)` from Task 3.
- Produces: `SupabaseDocsWordModerationGateway.deleteWord(command)` and `BrowserWordModerationServices.directWordDeletionService`.

- [ ] **Step 1: Add failing gateway tests for RPC payload, response parsing, and error sanitization**

```ts
rpc.mockResolvedValue({
    data: { deletedWordCount: 1, affectedDocsIds: [9, 3] },
    error: null,
});

await expect(gateway.deleteWord({ wordId: 17 })).resolves.toEqual(ok({
    deletedWordCount: 1,
    affectedDocsIds: [3, 9],
}));

expect(rpc).toHaveBeenCalledWith('delete_word_directly', {
    p_word_id: 17,
});
```

Test `deletedWordCount !== 1`, duplicate/non-positive docs IDs, null/non-object results, all five `DIRECT_WORD_DELETION_*` codes, thrown RPC calls, and unexpected PostgREST errors. Unexpected details must not appear in the returned message.

- [ ] **Step 2: Run the gateway test and verify the missing-method failure**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts --runInBand`

Expected: FAIL because `deleteWord` is not implemented.

- [ ] **Step 3: Implement direct-delete RPC mapping**

Add `deleteWord` to the existing adapter. Use these exact safe mappings:

```ts
const directWordDeletionErrors = {
    DIRECT_WORD_DELETION_UNAUTHORIZED: { kind: 'unauthorized', message: '인증이 필요합니다.' },
    DIRECT_WORD_DELETION_FORBIDDEN: { kind: 'forbidden', message: '관리자 권한이 필요합니다.' },
    DIRECT_WORD_DELETION_INVALID_INPUT: { kind: 'validation', message: '삭제할 단어 정보가 올바르지 않습니다.' },
    DIRECT_WORD_DELETION_CONFLICT: { kind: 'conflict', message: '단어가 이미 삭제되었거나 변경되었습니다.' },
    DIRECT_WORD_DELETION_INTERNAL_ERROR: { kind: 'infrastructure', message: '단어 삭제 중 오류가 발생했습니다.' },
} as const;
```

Parse `unknown` data defensively, sort `affectedDocsIds`, reject duplicates, and preserve only the PostgREST error code.

- [ ] **Step 4: Wire and export the direct-delete service**

Construct one `SupabaseDocsWordModerationGateway` and inject the same instance into both target and direct-delete services:

```ts
const docsGateway = new SupabaseDocsWordModerationGateway();

docsWordMutationTargetService: new GetDocsWordMutationTargetsService(docsGateway),
directWordDeletionService: new DeleteWordDirectlyService(docsGateway),
```

Export the direct-delete types/service through `src/modules/word-moderation/index.ts`.

- [ ] **Step 5: Run adapter and composition tests**

Run: `npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.ts src/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.ts src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/infrastructure/browser/supabase-docs-word-moderation-gateway.test.ts src/__tests__/modules/word-moderation/infrastructure/browser/browser-word-moderation-services.test.ts
git commit -m "feat: connect direct word deletion gateway"
```

---

### Task 5: Docs Word Moderation Presentation Hook

**Files:**
- Create: `src/modules/word-moderation/presentation/use-docs-word-moderation.ts`
- Create: `src/__tests__/modules/word-moderation/presentation/use-docs-word-moderation.test.tsx`
- Modify: `src/modules/word-moderation/index.ts`

**Interfaces:**
- Consumes: existing `WordRequestModerationService`, Task 1 `DeleteWordDirectlyService`, `DocsWordMutationTarget`, and `toModerateWordRequestsCommand`.
- Produces: `useDocsWordModeration(services?)` with `approve`, `reject`, `deleteDirectly`, `isPending`, `error`, and `clearError`.

- [ ] **Step 1: Write failing hook tests**

Use a `QueryClientProvider` with mutation retries disabled. Assert:

```ts
await result.current.approve({
    kind: 'word-request',
    requestId: 5,
    requestType: 'add',
    selectedThemeIds: [4, 2],
});

expect(requestService.approvedCommands).toEqual([{
    selections: [{ kind: 'word-request', requestId: 5, selectedThemeIds: [2, 4] }],
}]);
```

Also cover one theme-change approval, request rejection, registered-word direct deletion, wrong target/action validation, pending state, explicit error clearing, failed `Result` exposure, and unexpected exceptions converted to `{ kind: 'infrastructure', message: '문서 단어 처리 중 오류가 발생했습니다.' }`.

- [ ] **Step 2: Run the hook test and verify it fails**

Run: `npx jest src/__tests__/modules/word-moderation/presentation/use-docs-word-moderation.test.tsx --runInBand`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement one React Query mutation facade**

```ts
export interface DocsWordModerationServices {
    wordRequestModerationService: WordRequestModerationService;
    directWordDeletionService: DirectWordDeletionService;
}

export function useDocsWordModeration(services?: DocsWordModerationServices): {
    approve(target: Exclude<DocsWordMutationTarget, { kind: 'registered-word' }>): Promise<Result<WordRequestModerationResult>>;
    reject(target: Exclude<DocsWordMutationTarget, { kind: 'registered-word' }>): Promise<Result<WordRequestModerationResult>>;
    deleteDirectly(target: Extract<DocsWordMutationTarget, { kind: 'registered-word' }>): Promise<Result<DeleteWordDirectlyResult>>;
    isPending: boolean;
    error: ApplicationError | null;
    clearError(): void;
}
```

Use one mutation key/facade so any administrator action disables every other action. Clear old errors in `onMutate`; store failed `Result` errors in `onSuccess`; catch thrown exceptions inside `mutationFn`.

- [ ] **Step 4: Run hook tests and the existing request-moderation hook tests**

Run: `npx jest src/__tests__/modules/word-moderation/presentation/use-docs-word-moderation.test.tsx src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: Export the hook and types, then commit Task 5**

```bash
git add src/modules/word-moderation/presentation/use-docs-word-moderation.ts src/modules/word-moderation/index.ts src/__tests__/modules/word-moderation/presentation/use-docs-word-moderation.test.tsx
git commit -m "feat: add docs word moderation hook"
```

---

### Task 6: Docs UI Migration and Legacy User-Action Split

**Files:**
- Create: `src/app/words-docs/[id]/docs-word-data.ts`
- Create: `src/app/words-docs/[id]/use-user-word-request-actions.ts`
- Create: `src/__tests__/words-docs/id/Table.test.tsx`
- Create: `src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx`
- Modify: `src/app/words-docs/[id]/DocsDataPage.tsx`
- Modify: `src/app/words-docs/[id]/DocsDataHome.tsx`
- Modify: `src/app/words-docs/[id]/WordsTableBody.tsx`
- Modify: `src/app/words-docs/[id]/Table.tsx`
- Modify: `src/app/words-docs/[id]/WorkModal.tsx`
- Delete: `src/app/words-docs/[id]/TableWorkFunc.tsx`

**Interfaces:**
- Consumes: `docsWordMutationTargetService` from Task 2 and `useDocsWordModeration` from Task 5.
- Produces: `DocsWordData`, `useUserWordRequestActions`, and a Table flow with identifier-based administrator actions plus unchanged user callbacks.

- [ ] **Step 1: Write failing Table characterization and regression tests**

Mock `useDocsWordModeration` and `useUserWordRequestActions`, wrap the Table in Redux and React Query providers, and use these rows:

```ts
const rows: DocsWordData[] = [
    {
        word: '가방',
        status: 'add',
        maker: 'requester-1',
        mutationTarget: {
            kind: 'word-request',
            requestId: 7,
            requestType: 'add',
            selectedThemeIds: [3, 9],
        },
    },
    {
        word: '나비',
        status: 'delete',
        maker: 'requester-2',
        mutationTarget: {
            kind: 'theme-change',
            wordId: 11,
            themeId: 13,
            type: 'delete',
        },
    },
    {
        word: '다람쥐',
        status: 'ok',
        maker: undefined,
        mutationTarget: { kind: 'registered-word', wordId: 17 },
    },
];
```

Assert `admin` sees all relevant actions; `r4` and regular users do not see administrator actions; requester cancel buttons remain; add approve calls `approve` with the exact target; theme delete reject calls `reject`; registered delete calls `deleteDirectly`; null targets disable administrator actions; pending disables all actions; conflict/private errors show only the safe Korean message; and failures retain the work modal.

- [ ] **Step 2: Add failing success-state tests at the `DocsDataHome` state owner**

Assert the exact transitions:

```ts
add + approve     -> status ok, maker undefined, target registered-word from refreshed target result
add + reject      -> row removed
delete + approve  -> row removed
delete + reject   -> status ok
ok + direct delete -> row removed
```

Because an approved add receives a new DB `wordId` that the old target does not contain, do not synthesize a registered target. After successful add approval, call `docsWordMutationTargetService.get` for that single `ok` row and install the authoritative `registered-word` target. If that refresh fails, keep the row visible with `mutationTarget: null`, show the safe refresh error, and do not repeat the mutation.

- [ ] **Step 3: Run the Table tests and verify they fail against the legacy implementation**

Run: `npx jest src/__tests__/words-docs/id/Table.test.tsx --runInBand`

Expected: FAIL because the UI still calls `useWorkFunc` and lacks mutation targets.

- [ ] **Step 4: Define the feature row type and enrich rows during `DocsDataPage` loading**

```ts
export type DocsWordData = WordData & {
    mutationTarget: DocsWordMutationTarget | null;
};
```

After each existing `docsWords` branch builds its base rows, call:

```ts
const targetResult = await createBrowserWordModerationServices()
    .docsWordMutationTargetService
    .get({
        docsId: id,
        rows: baseRows.map(({ word, status }) => ({ word, status })),
    });
```

Require `targetResult.value.targets.length === baseRows.length`; otherwise show `ErrorPage` with the safe target-load message. Zip by index and pass `DocsWordData[]` through `DocsDataHome` and `WordsTableBody`.

- [ ] **Step 5: Move row ownership to `DocsDataHome`**

Change `const [wordsData]` to `const [wordsData, setWordsData]`. Provide Table with callbacks that update by target identity plus word/status, not by word alone. For successful add approval, resolve the new single-row target before setting `ok`; for other transitions use `setWordsData` directly. Keep mission/long filters derived from the current `wordsData`, not the original `data` prop.

- [ ] **Step 6: Replace administrator handlers in `Table.tsx`**

Remove `useWorkFunc`, PostgREST types, and raw administrator error mapping. Use:

```ts
const {
    approve,
    reject,
    deleteDirectly,
    isPending: isAdminMutationPending,
    error: adminMutationError,
    clearError,
} = useDocsWordModeration();
```

Before each administrator action, require a non-null target of the correct union member. Await the `Result`; on success invoke the parent transition callback, close the work modal, and open `CompleteModal`. On failure leave the work modal open. Map errors exactly:

```ts
validation     -> error.message
conflict       -> '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.'
unauthorized   -> '로그인이 필요합니다.'
forbidden      -> '관리자 권한이 필요합니다.'
infrastructure -> '문서 단어 처리 중 오류가 발생했습니다.'
```

Never render `error.message` for non-validation errors.

- [ ] **Step 7: Extract and test the three legacy user actions**

Move only these functions, with their existing SCM calls and PostgREST error callback contract, to `use-user-word-request-actions.ts`:

```ts
CancelAddRequest(word: string): Promise<void>
CancelDeleteRequest(word: string): Promise<void>
RequestDelete(word: string): Promise<void>
```

The hook receives `{ makeError, setIsProcessing, user, completeWork, isProcessing }`. Test the exact current call order: lookup by word, delete the wait row for cancellation, or insert `{ word, requested_by, request_type: 'delete', word_id }` for a request. Assert early return while processing and completion only after a successful final SCM call.

- [ ] **Step 8: Delete the legacy mixed hook and disable every action while pending**

Delete `TableWorkFunc.tsx` after its import count reaches zero. Pass `isSaving={isAdminMutationPending || isUserMutationProcessing}` to `WorkModal`; add `disabled` to `ActionBlock` buttons and prevent Dialog close/action callbacks while saving. Keep `isAdmin={user.role === 'admin'}` unchanged.

- [ ] **Step 9: Run all docs UI tests**

Run: `npx jest src/__tests__/words-docs/id/Table.test.tsx src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 10: Run the existing request-moderation presentation regression tests**

Run: `npx jest src/__tests__/admin/request-words/AdminRequestHome.test.tsx src/__tests__/modules/word-moderation/presentation/use-word-request-moderation.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 11: Commit Task 6**

```bash
git add src/app/words-docs/[id]/docs-word-data.ts src/app/words-docs/[id]/use-user-word-request-actions.ts src/app/words-docs/[id]/DocsDataPage.tsx src/app/words-docs/[id]/DocsDataHome.tsx src/app/words-docs/[id]/WordsTableBody.tsx src/app/words-docs/[id]/Table.tsx src/app/words-docs/[id]/WorkModal.tsx src/app/words-docs/[id]/TableWorkFunc.tsx src/__tests__/words-docs/id/Table.test.tsx src/__tests__/words-docs/id/use-user-word-request-actions.test.tsx
git commit -m "refactor: migrate docs word moderation actions"
```

---

### Task 7: Legacy Cleanup, Roadmap Update, and Full Verification

**Files:**
- Modify: `src/app/lib/supabase/ISupabaseClientManager.ts`
- Modify: `src/app/lib/supabase/SupabaseClientManager.ts`
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`
- Modify only if required by generated formatting/type commands: no generated DB type file may be edited manually.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: no administrator SCM mutation path in `words-docs/[id]`, an updated roadmap, and verified repository state.

- [ ] **Step 1: Prove which legacy methods became unused**

Run:

```bash
rg -n "waitWordById\(|waitWordsByIds\(|wordByWord\(" src
rg -n "SCM\.(add|delete|update)\(\)" "src/app/words-docs/[id]"
rg -n "@supabase/supabase-js|\.rpc\(|\.from\(" "src/app/words-docs/[id]/Table.tsx" "src/app/words-docs/[id]/WorkModal.tsx"
```

Expected after Task 6:

- `waitWordById`, `waitWordsByIds`, and `wordByWord` appear only in the legacy interface/implementation declarations and can be removed.
- `wordById`, `wordInfoByWord`, `waitWordInfoByWord`, `waitWordThemes`, `wordThemeByWordId`, docs/log/contribution methods still have other consumers and remain.
- Table and WorkModal contain no Supabase SDK, query builder, RPC name, or administrator SCM mutation call.

- [ ] **Step 2: Remove only the three proven-unused SCM methods**

Delete these declarations and implementations:

```ts
waitWordById(wordId: number)
waitWordsByIds(ids: number[])
wordByWord(word: string)
```

Run the searches from Step 1 again. Expected: zero occurrences for the three method names.

- [ ] **Step 3: Update the DDD-lite roadmap**

Change the status text to record:

- `words-docs/[id]` administrator request approval/rejection and direct deletion are complete.
- Existing request moderation RPCs are reused.
- Theme-change moderation now works and duplicate theme docs logs are eliminated.
- The three user request mutations remain Phase 2 legacy scope.
- The next Phase 1 action is `admin/request-docs/RequestDocsHome.tsx` characterization and transaction-boundary design.
- The direct-delete cloud migration remains an operator-controlled rollout item.

Recalculate the SCM import/call snapshot, change its baseline date to 2026-08-22, and replace the two numeric values with the counts produced by:

```bash
git grep -l -E "import .*SCM" -- "src/**/*.ts" "src/**/*.tsx"
git grep -n -E "\bSCM\." -- "src/**/*.ts" "src/**/*.tsx"
```

- [ ] **Step 4: Run focused Jest tests**

Run:

```bash
npx jest src/__tests__/modules/word-moderation src/__tests__/admin/request-words src/__tests__/words-docs --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run required lint and TypeScript verification**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands exit 0. Fix only failures caused by this migration; report pre-existing failures without changing unrelated code.

- [ ] **Step 6: Run the full Jest suite**

Run: `npm run test -- --runInBand`

Expected: PASS. If the suite is prohibitively expensive, preserve the focused PASS evidence and report that the full suite was not completed.

- [ ] **Step 7: Re-run the actual DB tests and always stop Supabase**

Run:

```bash
supabase start
supabase migration up --local
npm run test:direct-word-deletion-db
npm run test:word-request-moderation-db
supabase stop
```

Expected: both DB suites PASS and the local stack stops. If any command before `supabase stop` fails, run `supabase stop` separately before diagnosing or reporting.

- [ ] **Step 8: Check formatting and architecture boundaries**

Run:

```bash
git diff --check
rg -n "SCM|@supabase/supabase-js|\.rpc\(|\.from\(" "src/app/words-docs/[id]/Table.tsx" "src/app/words-docs/[id]/WorkModal.tsx"
git status --short
```

Expected: `git diff --check` exits 0; the boundary search returns no matches; status contains only the intended Task 7 files before commit.

- [ ] **Step 9: Commit cleanup and documentation**

```bash
git add src/app/lib/supabase/ISupabaseClientManager.ts src/app/lib/supabase/SupabaseClientManager.ts docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: remove docs moderation legacy paths"
```

- [ ] **Step 10: Final verification evidence**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: clean worktree and the seven implementation commits in plan order.
