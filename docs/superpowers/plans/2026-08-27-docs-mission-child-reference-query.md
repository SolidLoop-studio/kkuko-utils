# Docs Mission Child Reference Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every mission-child docs page derive its mission family, character, query path, and `isSpecial` flag from immutable `reference_code` values so the page works when `docs.id` values differ from legacy production IDs.

**Architecture:** Put the canonical three mission families and fourteen child suffixes in a pure docs Application helper shared by marker and content queries. The browser content gateway parses the selected docs row, uses the semantic child descriptor to select the existing read-only RPC and word ordering, and returns the existing `DocsContentProjection`; presentation continues to consume only that projection. This is a browser read refactor only: it adds no database migration, API route, or cloud rollout.

**Tech Stack:** TypeScript 5, React 19, Next.js 15 App Router, Supabase JS 2, TanStack React Query 5, Jest 30, Testing Library

**Spec:** `docs/architecture/ddd-lite-migration-roadmap.md`

## Global Constraints

- Preserve the existing mission characters and canonical order: `가나다라마바사아자차카타파하`, with suffixes `ga`, `na`, `da`, `ra`, `ma`, `ba`, `sa`, `a`, `ja`, `cha`, `ka`, `ta`, `pa`, `ha`.
- Treat the ten slices in `docs/superpowers/plans/2026-08-26-ddd-lite-next-ten-slices.md` as completed prerequisites; do not recreate their marker/content/query work.
- Serial merge position: **1 of 5**. Implement and merge this plan first; the notification-delete plan starts from this merged commit. These five plans are intentionally serial and must not be implemented as independent cherry-picks from the planning base.
- Accept only children of `ko.word-chain.mission`, `ko.reverse-word-chain.mission`, and `ko.kkungkkungtta.mission`; parent codes, unknown suffixes, and lookalike prefixes are not mission children.
- Word-chain children use `get_mission_words` and first-character grouping; reverse-word-chain children use `get_mission_words` and last-character grouping; Kkungkkungtta children use `get_mission_len3_words` and first-character grouping.
- `isSpecial` is true exactly for the 42 canonical mission-child references and never because a numeric `docs.id` falls in a range.
- Keep the already semantic mission-parent marker behavior and missing-marker `null` slots unchanged.
- Do not add methods to `SCM`, edit `src/app/types/database.types.ts`, add a database migration, contact a linked database, or perform a cloud rollout.
- Domain/Application code must not import Supabase, React, Next.js, or generated database types; Infrastructure alone owns RPC names and table columns.
- Returned or thrown Supabase failures and malformed rows map to the existing stable infrastructure message; no raw database detail reaches presentation.
- Follow RED-GREEN TDD for every task and update `docs/architecture/ddd-lite-migration-roadmap.md` in the same implementation branch.

---

## File Structure

Create:

- `src/modules/docs/application/docs-reference-types.ts` — canonical mission parent/child reference catalog and pure exact parser.
- `src/__tests__/modules/docs/application/docs-reference-types.test.ts` — exact parent/child parsing coverage.

Modify:

- `src/modules/docs/application/docs-marker-query-types.ts` — retain marker DTOs and re-export the shared parent predicate.
- `src/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.ts` — build child codes from the shared catalog instead of private duplicate arrays.
- `src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.ts` — replace mission-child numeric ranges with semantic descriptors.
- `src/modules/docs/index.ts` — export only the stable reference types/helpers needed outside the module, if a consumer test needs them.
- `docs/architecture/ddd-lite-migration-roadmap.md` — mark mission-child content classification/query routing and varying-PK page coverage complete without claiming cloud rollout.
- `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts` — guard shared-catalog ordering and missing slots.
- `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts` — cover remapped child PKs and exact RPC selection.
- `src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx` — prove a remapped child projection reaches `DocsDataHome` as special.

---

### Task 1: Define the Canonical Mission Reference Catalog

**Files:**
- Create: `src/modules/docs/application/docs-reference-types.ts`
- Create: `src/__tests__/modules/docs/application/docs-reference-types.test.ts`
- Modify: `src/modules/docs/application/docs-marker-query-types.ts`

**Interfaces:**
- Consumes: no Infrastructure or presentation types.
- Produces: `MissionFamily`, `MissionChildReference`, `MISSION_CHARACTERS`, `MISSION_KEYS`, `isMissionParentReferenceCode(referenceCode: string): boolean`, `missionChildReferenceCodes(parentReferenceCode: string): string[] | null`, and `parseMissionChildReferenceCode(referenceCode: string): MissionChildReference | null`.

- [ ] **Step 1: Write failing exact-catalog tests**

Create table-driven tests with these representative expectations and loop over all 42 family/suffix combinations:

```ts
expect(parseMissionChildReferenceCode('ko.word-chain.mission.ga')).toEqual({
    family: 'word-chain',
    character: '가',
    characterIndex: 0,
    usesLastCharacter: false,
});
expect(parseMissionChildReferenceCode('ko.reverse-word-chain.mission.na')).toEqual({
    family: 'reverse-word-chain',
    character: '나',
    characterIndex: 1,
    usesLastCharacter: true,
});
expect(parseMissionChildReferenceCode('ko.kkungkkungtta.mission.ha')).toEqual({
    family: 'kkungkkungtta',
    character: '하',
    characterIndex: 13,
    usesLastCharacter: false,
});
```

Also assert `null` for each parent code, `.unknown`, `.ga.extra`, `ko.custom.mission.ga`, an empty string, and a legacy numeric string.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx jest src/__tests__/modules/docs/application/docs-reference-types.test.ts --runInBand`

Expected: FAIL because `docs-reference-types.ts` does not exist.

- [ ] **Step 3: Implement the exact pure parser**

Use readonly catalogs and equality, not `startsWith` alone:

```ts
export type MissionFamily = 'word-chain' | 'reverse-word-chain' | 'kkungkkungtta';

export const MISSION_CHARACTERS = [
    '가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하',
] as const;
export const MISSION_KEYS = [
    'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha',
] as const;

const missionFamilies = [
    { family: 'word-chain', parentReferenceCode: 'ko.word-chain.mission', usesLastCharacter: false },
    { family: 'reverse-word-chain', parentReferenceCode: 'ko.reverse-word-chain.mission', usesLastCharacter: true },
    { family: 'kkungkkungtta', parentReferenceCode: 'ko.kkungkkungtta.mission', usesLastCharacter: false },
] as const;

export interface MissionChildReference {
    family: MissionFamily;
    character: (typeof MISSION_CHARACTERS)[number];
    characterIndex: number;
    usesLastCharacter: boolean;
}
```

`missionChildReferenceCodes` returns the fourteen exact codes only for a canonical parent. `parseMissionChildReferenceCode` compares the input against the generated exact code at each index and returns the matching descriptor or `null`.

- [ ] **Step 4: Move the parent predicate without breaking marker imports**

Import and re-export `isMissionParentReferenceCode` from `docs-marker-query-types.ts`, leaving `DocsMarker` and `DocsMarkerSlot` in that file. Do not duplicate the three parent strings.

- [ ] **Step 5: Run the pure tests and verify GREEN**

Run: `npx jest src/__tests__/modules/docs/application/docs-reference-types.test.ts src/__tests__/modules/docs/application/get-docs-markers.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit the catalog**

```bash
git add src/modules/docs/application/docs-reference-types.ts src/modules/docs/application/docs-marker-query-types.ts src/__tests__/modules/docs/application/docs-reference-types.test.ts
git commit -m "refactor: define semantic mission child references"
```

---

### Task 2: Reuse the Catalog in the Marker Gateway

**Files:**
- Modify: `src/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.ts`
- Modify: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts`

**Interfaces:**
- Consumes: `MISSION_CHARACTERS` and `missionChildReferenceCodes(parentReferenceCode)` from Task 1.
- Produces: unchanged `DocsMarkerQueryGateway.loadByParentDocsId(parentDocsId: number): Promise<Result<DocsMarkerSlot[] | null>>` behavior.

- [ ] **Step 1: Confirm the existing green shared-order characterization**

The existing adapter test already returns remapped child rows in reverse order, asserts fourteen canonical slots, and covers a missing `null` slot. Add any missing duplicate/unknown-child and non-parent assertions as preserved-behavior characterization only; do not couple the test to imports or private arrays.

- [ ] **Step 2: Run the marker adapter test and record the existing GREEN baseline**

Run: `npx jest src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts --runInBand`

Expected: PASS before the refactor. This test proves observable ordering/error behavior remains stable; Task 1's missing pure catalog and Task 3's remapped child content tests provide the actual RED evidence.

- [ ] **Step 3: Replace private arrays with the shared helper**

After validating the parent code, use:

```ts
const childReferenceCodes = missionChildReferenceCodes(parentReferenceCode);
if (childReferenceCodes === null) return err(nonParentError());
```

Use `MISSION_CHARACTERS[index]` when mapping rows. Preserve the single `.in('reference_code', childReferenceCodes)` query and `null` slots.

- [ ] **Step 4: Run the marker tests and verify GREEN**

Run: `npx jest src/__tests__/modules/docs/application/get-docs-markers.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts src/__tests__/modules/docs/presentation/use-docs-markers.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit the marker reuse**

```bash
git add src/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-marker-query-gateway.test.ts
git commit -m "refactor: share docs mission reference catalog"
```

---

### Task 3: Route Mission-Child Content by Reference Code

**Files:**
- Modify: `src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.ts`
- Modify: `src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts`

**Interfaces:**
- Consumes: `parseMissionChildReferenceCode(referenceCode)` from Task 1 and the existing `DocsContentQueryGateway` port.
- Produces: the unchanged `DocsContentProjection` shape, with `isSpecial` derived from a semantic child descriptor.

- [ ] **Step 1: Replace legacy-ID fixtures with failing remapped-PK cases**

Add these cases using IDs outside every legacy range:

```ts
it.each([
    [9_101, 'ko.word-chain.mission.ga', 'get_mission_words', 1, false],
    [9_202, 'ko.reverse-word-chain.mission.na', 'get_mission_words', 2, true],
    [9_303, 'ko.kkungkkungtta.mission.ha', 'get_mission_len3_words', 8192, false],
])('loads remapped mission child %s from %s', async (id, referenceCode, rpc, targetMask) => {
    // fixture returns an ect docs row carrying referenceCode and mission words
    const result = await new SupabaseDocsContentQueryGateway(client).loadByDocsId(id);
    expect(result).toEqual(ok(expect.objectContaining({ isSpecial: true })));
    expect(client.rpc).toHaveBeenCalledWith(rpc, { target_mask: targetMask });
});
```

For the reverse family, use words whose first- and last-character groupings produce different order and assert the existing last-character result. Add negative cases proving legacy ID `209` with `reference_code: null`, a parent code, and an unknown child code are not special and do not call a mission RPC.

- [ ] **Step 2: Run the content adapter test and verify RED**

Run: `npx jest src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts --runInBand`

Expected: FAIL because the adapter still uses `209..222`, `224..237`, and `239..252`.

- [ ] **Step 3: Carry the parsed mission-child descriptor in private metadata**

Extend the private metadata only:

```ts
type DocsMetadata = DocsContentProjection['metadata'] & {
    duem: boolean;
    missionChild: MissionChildReference | null;
    isMissionParent: boolean;
};
```

After narrowing `row.reference_code` to `string | null`, parse it once into `missionChild`; use the same raw reference to calculate `isMissionParent`. When returning the public projection, destructure `missionChild` away with `duem`; do not add a database reference field to `DocsContentProjection`.

- [ ] **Step 4: Remove mission numeric ranges and select the RPC semantically**

Delete `isSpecialMissionDocsId` and the mission `ranges` array. In `loadEctWords`, retain the existing long-word branch as-is, then parse the child reference:

```ts
const missionChild = metadata.missionChild;
if (missionChild === null) return null;

const functionName = missionChild.family === 'kkungkkungtta'
    ? 'get_mission_len3_words'
    : 'get_mission_words';
const response = await this.client.rpc(functionName, {
    target_mask: 1 << missionChild.characterIndex,
});
```

Pass `missionChild.character` and `missionChild.usesLastCharacter` to `selectMissionWords`. In `loadByDocsId`, set `isSpecial: metadata.missionChild !== null`; mission parents remain `isMissionParent: true`, `isSpecial: false`, and issue no word query.

- [ ] **Step 5: Keep error narrowing stable**

Malformed/non-string `reference_code`, returned RPC errors, thrown RPC promises, and malformed word rows must still return:

```ts
err({
    kind: 'infrastructure',
    message: '문서 단어를 불러오는 중 오류가 발생했습니다.',
})
```

- [ ] **Step 6: Run the content adapter tests and verify GREEN**

Run: `npx jest src/__tests__/modules/docs/application/docs-reference-types.test.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts --runInBand`

Expected: PASS, including all three remapped families and negative exact-match cases.

- [ ] **Step 7: Commit semantic content routing**

```bash
git add src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.ts src/__tests__/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway.test.ts
git commit -m "refactor: route mission child docs semantically"
```

---

### Task 4: Prove the Remapped Child Page Behavior

**Files:**
- Modify: `src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx`
- Modify: `src/modules/docs/index.ts` only if the test/application consumer needs a public reference type export.

**Interfaces:**
- Consumes: existing `useDocsContent` projection and `DocsDataHome` `isSpecial` prop.
- Produces: no new runtime API; adds a page-level regression test.

- [ ] **Step 1: Make the table test double expose special-mode input as characterization coverage**

Extend the existing `WordsTableBody` fake with the real optional prop shape and render it:

```tsx
isSp?: { m: string };
// inside the fake
<output data-testid="special-mission">{isSp?.m ?? 'ordinary'}</output>
```

- [ ] **Step 2: Add an existing-green remapped child presentation test**

Return a mocked content projection with `metadata.id: 9_101`, title ending in `가`, `type: 'ect'`, `isSpecial: true`, and `isMissionParent: false`. Assert that the word row renders, the marker-parent grid does not render, and `special-mission` contains `가`. This proves only that presentation forwards the existing projection field; it does not execute or prove the Supabase semantic classifier.

- [ ] **Step 3: Run the page integration test and record GREEN characterization**

Run: `npx jest src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx --runInBand`

Expected before and after Tasks 1–3: PASS because the test mocks `createBrowserDocsServices`. Rely on Task 3's adapter test for the genuine pre-change RED regression.

- [ ] **Step 4: Commit the page regression**

```bash
git add src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx src/modules/docs/index.ts
git commit -m "test: cover remapped mission child docs page"
```

---

### Task 5: Preserve the Live Admin-Logs Getter, Update the Roadmap, and Verify

**Files:**
- Modify: `docs/architecture/ddd-lite-migration-roadmap.md`

**Interfaces:**
- Consumes: the completed docs mission-child content path and the observed admin-logs consumer.
- Produces: an accurate roadmap status while retaining the still-live `GetManager.allDocs` legacy surface for a later admin-logs query slice.

- [ ] **Step 1: Verify and record the live legacy consumer**

Run: `git grep -n "SCM.get().allDocs" -- ":(literal)src/app/admin/logs/AdminLogsWrapper.tsx"`

Expected: the live call at `AdminLogsWrapper.tsx`; therefore this mission-child slice must not remove `allDocs`.

- [ ] **Step 2: Leave `allDocs` intact and bound its later owner**

Do not edit `SupabaseClientManager.ts` or `ISupabaseClientManager.ts`. Record `SCM.get().allDocs` under a named future admin-logs projection slice together with `AdminLogsWrapper`; do not expand this plan to migrate that unrelated user action.

- [ ] **Step 3: Update the binding roadmap**

In Phase 4 and the progress table, record that mission-child `isSpecial`, mission family/RPC selection, target character, and varying-PK child page coverage now come from the immutable reference catalog. Keep `docs context` as `부분 완료`, explicitly retain the live admin-logs `allDocs` consumer for its own projection slice, and retain the statement that Phase 0B cloud rollout is operator-controlled and not completed here.

- [ ] **Step 4: Run architecture grep checks**

Run each command separately:

```bash
git grep -n -E "209 <=|224 <=|239 <=|metadata\.id -|isSpecialMissionDocsId" -- "src/modules/docs/**/*.ts"
git grep -n "export default function DocsDataPage" -- ":(literal)src/app/words-docs/[id]/DocsDataPage.tsx"
git grep -n "export default DocsDataHome" -- ":(literal)src/app/words-docs/[id]/DocsDataHome.tsx"
git grep -n -E "SCM|@supabase/supabase-js|\.from\(|\.rpc\(" -- ":(literal)src/app/words-docs/[id]/DocsDataPage.tsx" ":(literal)src/app/words-docs/[id]/DocsDataHome.tsx"
git grep -n -E "@supabase|database\.types|next/|react" -- "src/modules/docs/application/*.ts"
git grep -n "SCM.get().allDocs" -- ":(literal)src/app/admin/logs/AdminLogsWrapper.tsx"
```

Expected: the two positive sanity commands each print their direct literal target, the presentation forbidden-import command prints no output, the Application dependency command prints no output, and the final command still prints the intentionally deferred admin-logs consumer. The Infrastructure content adapter may contain `.rpc(` and is intentionally excluded from the presentation check.

- [ ] **Step 5: Run focused and project verification**

Run:

```bash
npx jest src/__tests__/modules/docs src/__tests__/words-docs/id/DocsDataPage.integration.test.tsx --runInBand
npm run lint
npx tsc --noEmit
npm run test -- --runInBand
git diff --check
git status --short
```

Expected: every command exits 0; status contains only the files named by this plan. Do not run `npm run verify:local-db` because the slice changes no schema/RPC, and do not run any linked/cloud Supabase command.

- [ ] **Step 6: Commit cleanup and roadmap status**

```bash
git add docs/architecture/ddd-lite-migration-roadmap.md
git commit -m "refactor: complete semantic mission child docs query"
```
