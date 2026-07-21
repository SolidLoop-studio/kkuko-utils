# Typing Practice Design

## Overview

Add a typing-practice mode to `/mini-game` so users can train fast, accurate entry of words that already exist in their uploaded mini-game word database. This mode is not a prompt-response or start-character training mode. It shows a target word, asks the user to type it exactly, and measures typing speed, Korean-friendly characters per minute, accuracy, and combo stability.

The feature must feel like part of the existing mini-game. It reuses the current word upload flow, IndexedDB word storage, game frame, menu style, input styling, graph bar, and result-history patterns where practical. The typing-practice loop must stay separate from the existing word-chain game logic so the current game behavior remains stable.

## Goals

- Let users practice typing uploaded kkuko words quickly and without mistakes.
- Reuse the existing `/mini-game` word database instead of creating another data source.
- Display live WPM, characters per minute, accuracy, combo, and progress while practicing.
- Show a result summary after a timed or fixed-word-count session.
- Keep typing-practice logic testable as pure calculations where possible.

## Non-Goals

- Do not build 제시어 대응 훈련. The existing word-chain mini-game already covers thinking of words from a prompt.
- Do not save typing records to Supabase or user accounts in the first version.
- Do not add ranking, achievements, multiplayer, or daily challenges.
- Do not change the word-chain game rules, hint behavior, chat command behavior, or `GameManager` semantics.

## Entry Point and Mode Selection

`/mini-game` remains the single entry point. The pre-game setup surface gains a practice-type selector with two choices:

- `단어 연습`: the current word-chain practice game.
- `타자 연습`: the new target-word typing mode.

The existing word database section remains shared. Uploading, listing, editing, and deleting words continue to use `wordDB.ts` and `WordManagerModal`.

The selected practice type persists in `localStorage` under `kkutu_practice_type`. Existing word-chain settings continue to use `kkutu_game_setting`.

## Architecture

Add typing-practice code under `src/app/mini-game/game/typing-practice/`.

Suggested files:

- `TypingPracticeBody.tsx`: main typing-practice play screen.
- `TypingPracticeResultModal.tsx`: result summary shown when a session ends.
- `TypingPracticeSettings.tsx`: setup controls specific to typing practice.
- `hooks/useTypingPractice.ts`: React state orchestration for the typing session.
- `lib/TypingPracticeLogic.ts`: pure functions for metrics, matching, combo, and next-word selection.
- `types/typing-practice.types.ts`: mode-specific settings, session state, and result types.

The existing `Game.tsx` remains the top-level composition point. It chooses between `GameBody` and `TypingPracticeBody` based on the selected practice type and `isPlaying` state. Shared menu and shell components stay outside mode-specific logic.

Do not merge typing-practice behavior into `GameManager`, `GameLogic`, or `useGameLogic`. Those modules continue to own only the current word-chain game loop.

## Shared UI Reuse

Reuse these existing pieces where practical:

- `KkutuMenu` for help/settings/dictionary/start/exit controls.
- `GameBox` as the framed game area.
- `GameInput` for the typing input visual style.
- `GraphBar` for session time or word-count progress.
- `ConfirmModal` for exit confirmation.
- `DictionaryModal` and `WordManagerModal` unchanged.

The central word display area keeps the existing mini-game visual language but shows typing-specific information:

- Target word in the main display.
- Per-character highlighting:
  - correct typed prefix: success color
  - current mismatch: error color
  - remaining characters: neutral color
- Left/right side counters adapted for typing practice:
  - combo or max combo
  - accuracy or remaining words
- Compact live stat row:
  - WPM
  - 분당타자수
  - 정확도
  - 콤보

The chat box is not the primary typing input for this mode. Typing practice uses the game input directly to avoid confusing chat commands with target-word input. Chat remains visible for layout consistency, but Enter in the typing-practice input submits the target word and does not send chat.

## Typing Practice Settings

The MVP includes only the settings that directly affect a session:

- Session type:
  - timed: 30, 60, or 120 seconds
  - fixed count: 10, 25, or 50 words
- Language filter:
  - Korean
  - English
  - all uploaded words
- Word order:
  - random
  - sorted
- Minimum word length:
  - default 2
  - configurable up to a conservative limit such as 10

Settings persist in `localStorage` using `kkutu_typing_practice_setting`.

## Data Flow

1. `GameSetup` checks whether words exist using `hasWords()`.
2. When a typing-practice session starts, `useTypingPractice` loads words through `getAllWords()`.
3. The words are normalized consistently with the existing mini-game expectations:
   - lowercase English
   - remove unsupported symbols
   - ignore words shorter than the configured minimum length
4. `TypingPracticeLogic` filters by language and prepares the session queue.
5. The hook tracks current target, raw input, submitted attempts, elapsed time, and aggregate metrics.
6. When the timer expires or fixed word count is completed, the hook opens the result modal.

The first version may load the full word list into memory, matching the current mini-game behavior. No new IndexedDB stores are required.

## Input and IME Handling

Typing practice must handle Korean IME composition correctly.

- During `compositionstart` to `compositionend`, live mismatch judging is deferred or treated as provisional.
- Final correctness is checked after composition ends and Enter submits.
- Backspace and correction before Enter do not directly affect final accuracy. For MVP, accuracy is based on submitted text, not every physical keypress, to avoid overcounting IME composition edits.

Submission rules:

- Enter submits the current input.
- Exact match succeeds.
- Non-empty mismatch fails the word attempt, resets current combo, records the submitted text, and advances to the next target.
- Empty input does nothing.

This keeps the training focused on mistake-free final entry while still showing live mismatch feedback.

## Metrics

Use explicit formulas so tests and UI agree.

Elapsed time:

- Start timing when the typing-practice body enters active state.
- Clamp elapsed time to at least 1 second when computing rates to avoid division by zero.

Correct characters:

- For each submitted attempt, compare target and submitted text by character index.
- Count characters that exactly match at the same index.
- A fully correct word contributes its full length.

Total submitted characters:

- Sum submitted text lengths across attempts.

Accuracy:

```text
accuracy = correctCharacters / max(totalSubmittedCharacters, 1) * 100
```

WPM:

```text
wpm = correctCharacters / 5 / elapsedMinutes
```

분당타자수:

```text
charactersPerMinute = correctCharacters / elapsedMinutes
```

Combo:

- Increase by 1 for each exact word match.
- Reset to 0 for each submitted mismatch.
- Track max combo separately.

Additional result fields:

- completedWords
- failedWords
- totalAttempts
- averageWordTime
- longestCombo
- session duration

## Result Summary

At session end, show a result modal with:

- WPM
- 분당타자수
- 정확도
- 완료 단어 수
- 실패 단어 수
- 최대 콤보
- 연습 시간
- recent attempts list with target word, submitted text, and success/failure

The modal offers:

- `다시 시작`: starts a new session using the same settings.
- `설정으로 돌아가기`: exits to setup.
- `닫기`: closes the modal while leaving the finished state visible.

No persistent record history is required for MVP.

## Error and Edge Cases

- If no words are uploaded, starting typing practice is blocked with the existing start-blocked modal pattern.
- If filters remove all words, show a specific blocked message telling the user to adjust language or minimum length.
- If a session runs out of words in fixed-count mode, end the session early with available results.
- If the user exits mid-session, show the existing confirmation modal style.
- If the browser does not support IndexedDB, preserve the current mini-game error behavior and do not add a separate fallback.
- Mobile remains unsupported for `/mini-game` because the route is currently desktop-only.

## Testing Plan

Unit tests for `TypingPracticeLogic`:

- Filters Korean, English, and all-word queues correctly.
- Produces deterministic sorted order.
- Produces random order without dropping or duplicating words.
- Computes correct characters for exact, partial, shorter, and longer submissions.
- Computes accuracy, WPM, characters per minute, combo, and max combo.
- Handles zero elapsed time by clamping rate calculations.

Component tests:

- Setup blocks typing-practice start when no words exist.
- Typing-practice start loads words from IndexedDB and renders a target word.
- Correct submission advances to the next word and increments combo.
- Incorrect submission advances to the next word and resets combo.
- Live character highlighting shows correct and incorrect portions.
- Timed session opens the result modal when time expires.
- Fixed-count session opens the result modal after the configured count.

Regression tests:

- Existing word-chain tests continue to pass.
- Existing `GameManager` and `useGameLogic` tests must not require behavior changes.

## Implementation Notes

- Keep Redux limited to screen-level state, consistent with the current rule that mini-game logic stays out of Redux.
- Prefer plain React hook state for typing-practice session state.
- Keep metric calculations in pure functions and call them from the hook.
- Reuse `getAllWords()` rather than adding another storage abstraction.
- Avoid adding dependencies for typing metrics; the formulas are small and deterministic.
- Update the mini-game help modal to include a concise 타자 연습 section.
- Keep UI dimensions stable with the existing 1000px desktop game layout.

## Resolved Decisions

- Timing starts immediately when the typing-practice body enters active state.
- Failed non-empty submissions advance to the next target and reset combo.
- Chat remains visible for layout consistency, but the dedicated `GameInput` owns practice submissions.
