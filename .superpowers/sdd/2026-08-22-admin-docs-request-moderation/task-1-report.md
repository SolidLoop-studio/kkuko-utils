# Task 1: Characterize the Existing Request Docs UI

## Implementation

Added `src/__tests__/admin/request-docs/RequestDocsHome.test.tsx` as a characterization safety net for the legacy `DocsWaitManager` UI. The fixture uses request IDs 11 and 22 and mocks the legacy `SCM.add().docs` and `SCM.delete().waitDocsByIds` calls. The four tests cover:

- approval payload mapping with the selected request and `두음 적용: true`, followed by successful row removal;
- docs insertion failure preserving the request and preventing deletion;
- request deletion failure preserving the selected request and showing the legacy error modal;
- rejection deletion mapping and successful row removal.

No production code was changed. This is characterization-only; the test was expected to pass against the existing implementation rather than being a fabricated TDD RED run.

## Commands and exact results

Command:

```text
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx --runInBand --coverage=false
```

Result:

```text
PASS src/__tests__/admin/request-docs/RequestDocsHome.test.tsx
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Time:        4.839 s
```

Command:

```text
git diff --check
```

Result: no diff-check errors. Git emitted only pre-existing environment warnings that it could not access `C:\Users\jtw79/.config/git/ignore`.

## Files changed

- `src/__tests__/admin/request-docs/RequestDocsHome.test.tsx` — new characterization test suite.
- `.superpowers/sdd/2026-08-22-admin-docs-request-moderation/task-1-report.md` — this report.

## Self-review

- Assertions verify exact docs payload fields (`name`, `maker`, `duem`, `typez`) and exact request IDs.
- Failure cases verify both state preservation and the legacy error message surface.
- Success cases verify rows disappear only after the relevant SCM calls resolve.
- No production files were modified.

## Fix round 1

The approval success characterization now uses deferred promises for both the docs insertion and request deletion. It asserts the request row remains after insertion resolves and `waitDocsByIds` has been called, and disappears only after deletion resolves. This directly proves cleanup waits for both legacy mutations.

Command:

```text
npx jest src/__tests__/admin/request-docs/RequestDocsHome.test.tsx --runInBand --coverage=false
```

Result:

```text
PASS src/__tests__/admin/request-docs/RequestDocsHome.test.tsx
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Time:        4.65 s
```

Command:

```text
git diff --check
```

Result: no diff-check errors. Git emitted only the line-ending warning for the modified test file.

This remains a characterization test: the deferred assertions document the observable legacy sequencing without changing production behavior. The raw legacy Postgrest error message assertions are intentionally retained per the controller ruling; a later task will replace them with stable application errors.
