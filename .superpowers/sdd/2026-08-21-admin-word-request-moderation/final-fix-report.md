# Admin word request moderation final fix report

Date: 2026-08-21

Fix commit: `7b172ed` (`fix: correct word request moderation boundaries`)

## Scope and outcome

This wave addresses only the four Important final-review findings:

1. The browser gateway now maps all five literal database error messages (`WORD_REQUEST_MODERATION_UNAUTHORIZED`, `WORD_REQUEST_MODERATION_FORBIDDEN`, `WORD_REQUEST_MODERATION_INVALID_INPUT`, `WORD_REQUEST_MODERATION_CONFLICT`, and `WORD_REQUEST_MODERATION_INTERNAL_ERROR`) to stable application kinds and safe Korean messages.
2. Word-request rejection still validates the authoritative pending row by request ID, but selected-theme validation and approval eligibility no longer run during rejection. The UI-real add payload with `selectedThemeIds: []` deletes and logs the request atomically.
3. Theme-change approval no longer increments either `contribution` or `month_contribution` for the theme requester.
4. Theme-change approval no longer recalculates `words.noin_canuse`; selected theme additions/deletions leave the stored value unchanged.

No package script or testing-document change was needed because the existing focused commands already cover behavior and concurrency.

## RED evidence

### Finding 1: literal gateway error mapping

Command:

```text
npx jest src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts --runInBand
```

Result: exit `1`; one suite failed, with `4 failed / 10 passed / 14 total`. The four authorization, permission, validation, and conflict literals all returned the generic infrastructure result instead of their expected kinds and safe messages. `WORD_REQUEST_MODERATION_INTERNAL_ERROR` already matched the generic infrastructure fallback and passed.

### Finding 2: UI-real add rejection with empty themes

Local stack command:

```text
npx supabase start
```

Result: exit `0`; local Docker services started from the local backup. No `--linked`, project reference, or remote target was used.

Behavior command against the unmodified migration implementation:

```text
npx supabase test db --local supabase/tests/database/word-request-moderation.integration.sql
```

Result: exit `1`. The add-rejection call using `{kind:'word-request', requestId, selectedThemeIds:[]}` aborted with `WORD_REQUEST_MODERATION_CONFLICT` from `private.process_word_request_moderation`, proving approval eligibility still ran during rejection. Because the transaction aborted before `finish()`, pgTAP also reported the expected missing-plan parse error.

### Finding 3: theme-change contribution side effects

The same RED behavior run reported:

```text
Failed test 29: theme-change approval does not increment lifetime contribution
have: 2
want: 0
Failed test 30: theme-change approval does not increment monthly contribution
have: 2
want: 0
```

The fixture uses non-null requester `41000000-0000-4000-8000-000000000006` for the selected add and delete requests.

### Finding 4: theme-change noin_canuse side effect

The same RED behavior run reported:

```text
Failed test 31: theme-change approval leaves the word noin_canuse value unchanged
have: false
want: true
```

The fixture starts `moderation-theme-fixture-z` with `noin_canuse = true`, then approves one selected theme add and one selected theme delete.

## GREEN and verification evidence

The already-applied local migration version was reloaded without a database reset:

```text
npx supabase migration list --local
npx supabase migration repair --local --status reverted 20260821130000
npx supabase migration up --local
```

Results: all exited `0`; only local version `20260821130000` was marked reverted, then `20260821130000_admin_word_request_moderation.sql` was applied successfully.

Gateway GREEN:

```text
npm test -- src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts --runInBand
```

Result: exit `0`; `1/1` suite and `14/14` tests passed. Each of the five literal database messages was checked against an independently specified result kind, safe message, and `P0001` code.

Database behavior GREEN:

```text
npx supabase test db --local supabase/tests/database/word-request-moderation.integration.sql
```

Result: exit `0`; `1/1` file and `48/48` pgTAP tests passed.

Database concurrency GREEN:

```text
npx supabase test db --local supabase/tests/database/word-request-moderation-concurrency.integration.sql
```

Result: exit `0`; `1/1` file and `8/8` pgTAP tests passed, including the real two-session overlap and single-winner conflict assertions.

Lint:

```text
npm run lint
```

Result: exit `0`; no lint errors. Three pre-existing `@next/next/no-img-element` warnings remain in `src/app/mini-game/game/GameBody.tsx` at lines 114, 119, and 124.

TypeScript:

```text
npm exec -- tsc --noEmit
```

Result: exit `0`; no TypeScript diagnostics.

Diff quality:

```text
git diff --check
```

Result: exit `0`; no whitespace errors. Git emitted only the repository's LF-to-CRLF working-copy notices.

## Files changed

- `src/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.ts`
- `src/__tests__/modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway.test.ts`
- `supabase/migrations/20260821130000_admin_word_request_moderation.sql`
- `supabase/tests/database/word-request-moderation.integration.sql`
- `.superpowers/sdd/2026-08-21-admin-word-request-moderation/final-fix-report.md` (this report)

## Self-review

- The gateway table contains exactly the five stable database literals and retains the existing generic sanitization fallback for unexpected database details.
- Rejection retains unconditional pending `wait_words` lookup and matching `word_themes_wait`/theme identity validation; only selected-theme and current approved-relation eligibility are approval-only.
- Whole-word approval contribution behavior is unchanged; only the theme-change contribution block was removed.
- Add-word approval still derives initial `noin_canuse` from approved selected themes; only theme-change recalculation was removed.
- No deferred minor, generated database type, package, unrelated test, or application UI file changed.

## Local database cleanup

Stop command:

```text
npx supabase stop
```

Result: exit `0`; `Stopped supabase local development setup.`

Cleanup check:

```text
npx supabase status
```

Result: exit `1` with `No such container: supabase_db_kkuko-utils`, confirming the local database container is not running.

## Concerns and warnings

- No product-code concern remains from the four reviewed findings.
- The Windows PowerShell npm/npx shims print a sandbox `Test-Path` access warning for the user-level npm prefix even when the underlying command runs and exits successfully.
- Next.js reports multiple lockfiles/workspace-root inference during Jest and lint; this was pre-existing and outside the requested scope.
- Supabase reports the pre-existing deprecated `[inbucket]` config warning in favor of `[local_smtp]`; this was outside the requested scope.
