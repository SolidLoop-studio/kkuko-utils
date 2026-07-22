# Typing Practice Polish Design

## Overview

Polish the newly added `/mini-game` typing-practice mode based on play-test feedback. The main direction is parity with the existing word-practice experience: setup controls should look and behave like the current word-chain settings, in-game status should reuse the existing timing/progress language, modal flows should be consistent, and Korean IME input should make mistakes visible instead of hiding them during composition.

This document covers design only. Implementation should begin after review approval.

## Goals

- Make the practice-type selector and typing-practice settings easier to discover.
- Align typing-practice setup controls with the current word-practice UI patterns.
- Keep unused settings out of view depending on the selected session mode.
- Validate start conditions before entering the game screen, using the same blocked-start modal flow as word practice.
- Align the in-game progress display with word-practice timing/progress visuals.
- Move WPM, characters per minute, and accuracy to a more visible area below the input.
- Hide mission-specific UI in typing practice and show successful submitted word count in the chain area.
- Add sound feedback to typing practice by reusing the existing `SoundManager`.
- Make exit confirmation and exit-result behavior consistent with the rest of the mini-game UI.
- Fix Korean IME-aware target highlighting and metrics so typing errors are visible and rates are counted from committed submissions.

## Non-Goals

- Do not reintroduce a separate prompt-response or 제시어 대응 training mode.
- Do not change word-chain game rules, `GameManager`, or `useGameLogic` behavior except where a shared UI component needs a non-breaking extension.
- Do not add Supabase persistence, rankings, achievements, or profile history for typing-practice results.
- Do not add new audio assets unless an existing sound key is clearly unsuitable.
- Do not redesign the whole mini-game screen.

## Recommended Approach

Use a parity-first polish pass. Keep the typing-practice feature separated under `src/app/mini-game/game/typing-practice/`, but update the UI and behavior so it follows existing word-practice conventions.

Alternative approaches considered:

- Extract shared setting/progress/stat components first. This could reduce duplication, but it expands scope and risks touching stable word-practice behavior before the polish issues are fixed.
- Patch only the bugs and leave the current select-heavy UI. This is faster but does not address the core feedback that typing practice feels visually separate from word practice.

The recommended path is the smallest change set that directly addresses the UX mismatch: reuse current component patterns, add narrow helper functions where needed, and keep typing-practice orchestration independent.

## Setup Screen Changes

### Practice Type Visibility

Move or restyle the `연습 종류` selector so it is a primary setting, not a small row hidden inside the right settings panel.

Implementation direction:

- Keep it in `GameSetup.tsx`, since `practiceType` is already owned by `Game`.
- Use a visually stronger radio/segmented choice near the top of the settings panel, before mode-specific settings.
- Preserve labels `단어 연습` and `타자 연습`.
- Persist selection through the existing `writePracticeType` flow.

Acceptance:

- A first-time user can identify the current practice type before scanning detailed settings.
- Switching practice type does not reset uploaded words.

### Typing Settings UI Parity

Replace select boxes in `TypingPracticeSettings.tsx` with controls that match the current word-practice style:

- `세션 방식`: radio buttons for `시간 제한` and `단어 수 제한`.
- `언어`: radio buttons for `전체`, `한국어`, `English`.
- `단어 순서`: radio buttons for `랜덤`, `가나다순`.
- `연습 시간`: radio buttons or compact button choices for `30초`, `60초`, `120초`.
- `단어 수`: radio buttons or compact button choices for `10개`, `25개`, `50개`.
- `최소 글자 수`: keep numeric input, but style it consistently with the surrounding settings.

Only show the setting used by the selected session mode:

- If `sessionMode === 'timed'`, show `연습 시간` and hide `단어 수`.
- If `sessionMode === 'fixed-count'`, show `단어 수` and hide `연습 시간`.

Changing `연습 시간` should keep `sessionMode` as `timed`. Changing `단어 수` should keep `sessionMode` as `fixed-count`. Hidden values still persist so switching modes restores the previous choice.

### Start Validation

Typing practice currently checks only whether any words exist through `hasWords()`, then lets `useTypingPractice` discover that no matching words are available. That causes the game screen to start before the blocked state appears.

Change start validation in `Game.tsx` so the Start button validates the actual prepared queue:

- Load uploaded words from IndexedDB.
- Run the same normalization/filtering path used by `TypingPracticeLogic.prepareQueue`.
- If the prepared queue is empty, call `blockStart('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.')`.
- If no uploaded words exist at all, keep `blockStart('단어를 먼저 업로드해주세요.')`.
- Only call `startPractice()` after a non-empty queue is confirmed.

This preserves the word-practice blocked-start modal pattern through `KkutuMenu` and `ConfirmModal`.

## In-Game Screen Changes

### Progress Display

Typing practice should reuse the visual feel of word-practice `GraphBar`.

Timed mode:

- Show a yellow bar that decreases as time runs out.
- Label remaining time as `x.x초`.
- Use one decimal place, matching the word-practice feel.

Fixed-count mode:

- Use the same yellow `GraphBar` treatment.
- Show remaining count as text such as `남은 단어 N개`.
- Avoid the bare `x / y` label because it feels unrelated to the existing game timer.

`useTypingPractice` should continue exposing progress values, but the display component should convert elapsed/progress into mode-specific remaining labels.

### Stat Placement

Move live stats out of the compact bar directly under the target word and into the unused area below `GameInput`.

Display as a compact horizontal stat strip:

- `WPM`
- `분당타자수`
- `정확도`
- `콤보`

The strip should be visually connected to the input area, since these values describe the user's typing performance. Keep the central target/progress area focused on the current word and remaining session progress.

### Side Counters

Typing practice does not use mission characters.

- Hide the left mission-letter area or leave it visually empty like word-practice normal mode.
- Use the right `chain` area to show `completedWords`, the number of successfully entered words so far.
- Do not show accuracy in the chain area.

This keeps the side-counter semantics closer to word practice: the chain area represents accumulated success.

## Sound Changes

Typing practice should reuse the existing `soundManager` loaded in `Game.tsx`.

Add sound feedback at these events:

- Session start or restart: play an existing start sound such as `round_start` if appropriate.
- Correct submission: play an existing positive per-word sound used by word practice, preferably one of the short `K*` or `A*` sounds after confirming current sound behavior.
- Incorrect submission: play existing `fail`.
- Timed session end: play existing `timeout`.
- Fixed-count completion: play a short completion sound if one already exists; otherwise use the same neutral finish behavior as timed mode without adding a new asset.

Do not play sounds for every IME composition update. Sounds should fire only on committed actions: start, submitted attempt, and finish.

## Exit Flow Changes

`KkutuMenu` currently handles typing-practice exit by calling `exitGame()` after confirmation. That skips the typing-practice result modal.

Change the typing-practice exit flow so:

- Pressing Exit opens the existing confirm modal.
- The background game area is blurred/obscured consistently while the confirm modal is open.
- Confirming exit finishes the current typing-practice session and opens `TypingPracticeResultModal`.
- The result modal's setup/exit action then calls `exitGame()` and returns to setup.
- Canceling the confirm modal resumes the current session without clearing input or metrics.

Implementation direction:

- Add an exit-request callback path from `KkutuMenu` to `TypingPracticeBody`, or lift a minimal `requestTypingPracticeExit` signal into `Game.tsx`.
- Avoid storing typing session data in Redux. Keep Redux limited to the existing global play/start-blocked state.
- If no words have been attempted, still show the result modal with zeroed metrics so the user gets a clear end state.

## IME, Highlighting, and Metrics

### Current Problem

`TypingPracticeBody.renderTarget` colors every typed target character yellow while `isComposing` is true. For Korean IME, this hides committed mistakes before the currently composing syllable.

Example:

- Target: `단순누진율`
- Input during composition: `단수누`
- Expected visual: `단` correct, `순` incorrect, current composing syllable provisional, remaining neutral.
- Current visual: typed target range appears yellow, so the `순` vs `수` typo is not visible.

### Highlighting Rule

Use grapheme-like character arrays with `Array.from` after normalizing strings in the same way as scoring.

For display:

- Characters before the active composing index compare normally: green if exact, red/underline if mismatched.
- The active composing character is yellow only while `isComposing` is true.
- Characters after the input length remain neutral.
- After `compositionend`, all typed characters compare normally.
- Extra typed characters beyond the target should put the input into an error state and should not make target characters look correct.

For the example `단순누진율` with composing input `단수누`, the second target character must be red because the committed input character is `수`, not `순`.

### Metrics Rule

Rates should be based on committed submissions, not intermediate IME composition changes.

Metric definitions:

- `submittedCharacters`: count normalized submitted characters with `Array.from`.
- `correctCharacters`: count exact per-index matches between normalized target and normalized submitted value.
- `accuracy`: `correctCharacters / submittedCharacters * 100`, with `0` submitted characters guarded to avoid division by zero.
- `분당타자수`: `correctCharacters / elapsedMinutes`.
- `WPM`: `correctCharacters / 5 / elapsedMinutes`, using the standard 5-character word unit even though uploaded kkuko words usually have no spaces.
- `completedWords`: correct submitted attempts only.
- `failedWords`: submitted attempts that are not exact matches.

Whitespace entered by the user should not be treated as a word separator for WPM. Because the uploaded target words are normalized without spaces, whitespace should either be stripped by the same normalization path before scoring or clearly counted as incorrect input. The chosen behavior must be covered by tests and must match the visible highlight.

## Test Plan

Add or update focused tests before implementation:

- `TypingPracticeSettings` renders radio-style controls and conditionally shows only `연습 시간` or `단어 수`.
- `Game` start validation blocks typing practice before entering the game screen when the prepared queue is empty.
- `TypingPracticeBody` shows timed progress as remaining `x.x초` and no longer uses the bare `x / y` label for timed mode.
- `TypingPracticeBody` places WPM, 분당타자수, 정확도, and 콤보 under the input area.
- `TypingPracticeBody` hides mission UI and shows successful word count in the chain area.
- `TypingPracticeBody` Korean IME highlight marks committed mismatches red while only the active composing syllable is yellow.
- `TypingPracticeLogic.scoreAttempt` and `calculateMetrics` count Korean characters consistently and do not depend on spaces.
- `useTypingPractice` triggers mocked `soundManager` calls for start, correct submit, wrong submit, and finish.
- Typing-practice exit confirmation blurs/obscures the game area and confirming exit opens `TypingPracticeResultModal`.

Run verification after implementation:

- Focused Jest suites for typing-practice logic/components.
- `npx tsc --noEmit --incremental false`.
- `npm test`.
- `git diff --check`.

## Acceptance Criteria

- Setup screen makes `연습 종류` prominent and typing-practice settings visually match word-practice controls.
- Session-mode-specific settings are conditional: timed sessions show time only, fixed-count sessions show count only.
- Starting typing practice with no matching words shows the same modal-style blocked-start UX as word practice and does not enter the play screen.
- Timed typing practice shows a decreasing yellow progress bar with `x.x초` remaining.
- Live WPM, 분당타자수, 정확도, and 콤보 are visible below the input.
- Mission UI is hidden for typing practice, and the chain area shows successfully entered word count.
- Typing practice plays existing sound feedback for start, correct submit, wrong submit, and finish.
- Exit confirmation visually blurs/obscures the game screen, and confirming exit opens the result modal.
- Korean IME input exposes committed typos correctly, including the `단순누진율` / `단수누` case.
- WPM and 분당타자수 are calculated from committed submitted attempts using character counts, not whitespace-delimited word counts.
