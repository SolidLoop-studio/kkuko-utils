# Task 5 Report: Wire Mode Selection into Game Shell

## Status

BLOCKED

## Work Completed

- Added the required `Game` persisted practice-type and typing-settings read path.
- Added the required `TypingPracticeBody` conditional render path.
- Added the required `KkutuMenu` asynchronous `hasWords()` gate and exact blocked-start message.
- Added the requested Game-level integration coverage for typing-practice rendering and empty word storage.

## TDD Evidence

1. Added the two requested integration tests before production changes.
2. Ran `npx jest src/__tests__/mini-game/game/Game.test.tsx --coverage=false`.
3. Observed the intended RED failures: the typing body did not render and the empty-storage message was absent.
4. Implemented the Task 5 changes.
5. Re-ran the focused test. The empty-storage test passes, but the typing-start test remains blocked by the existing word-chain start guard.

## Blocking Issue

The Task 5 brief requires `KkutuMenu` to call `requestStart()` after the typing-practice `hasWords()` check and explicitly prohibits changing Redux slices/hooks. The existing `useGameState().requestStart()` always calls `gameManager.canGameStart()`, which checks word-chain state only. With uploaded typing-practice words, it returns `false` unless the word-chain `wordService` has separately been populated. The app therefore displays `게임을 시작할 수 없습니다.` and never changes `isPlaying`.

This makes the required `Game` integration test impossible to pass in production without changing `useGameState` (or otherwise adding a Redux-level typing-practice start action), which is outside the stated write scope and conflicts with the brief's instruction not to modify that hook.

## Current Focused Test Result

`npx jest src/__tests__/mini-game/game/Game.test.tsx --coverage=false`

- 2 passed
- 1 failed: `renders typing practice body when typing practice is selected and start is requested`

The test run also emits the existing Next.js multiple-lockfile workspace-root warning.

## Commit

No commit was created because the required focused test is not green.

---

## Completion Fix

### Root Cause

`useGameState().requestStart()` is specific to word-chain mode: it calls
`gameManager.canGameStart()` and sets `pendingStart`. Typing practice has its
own uploaded-word gate and must not invoke the word-chain guard.

### Fix

- Added `startPractice()` to `useGameState()`. It dispatches only
  `setPlaying(true)`.
- Kept `requestStart()` unchanged for word-chain mode.
- Updated `KkutuMenu` to call `startPractice()` only after a
  typing-practice `hasWords()` check passes.

### RED Evidence

After adding the focused hook test, this command failed as expected because
`startPractice` did not exist:

```text
npx jest src/__tests__/mini-game/game/hooks/useGameState.test.tsx --coverage=false
TypeError: result.current.startPractice is not a function
```

### GREEN Evidence

```text
npx jest src/__tests__/mini-game/game/Game.test.tsx src/__tests__/mini-game/game/hooks/useGameState.test.tsx --coverage=false
PASS src/__tests__/mini-game/game/hooks/useGameState.test.tsx
PASS src/__tests__/mini-game/game/Game.test.tsx
Test Suites: 2 passed, 2 total
Tests: 11 passed, 11 total
```
