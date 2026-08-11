# Typing Practice Long-Word Display Design

## Overview

Typing practice currently renders the complete target inside a fixed 474px, 20px, single-line strip with `overflow-hidden` and ellipsis styling. Scoring still compares the submitted input with the full target, so a user can type every visible character, press Enter, and receive an incorrect result for hidden characters they could not see.

Support registered Kkutu Korea words up to 100 characters without shrinking the target into unreadable text or expanding the game header into a large multi-line block. Long targets will keep the existing readable text size and move horizontally so the current typing position remains visible with nearby context.

## Goals

- Accept normalized target words from 2 through 100 characters.
- Keep the existing target font size for long words.
- Show the current input position and nearby preceding and upcoming characters.
- Make hidden content explicit through edge indicators and an `entered / total` counter.
- Prevent an incomplete Enter press from being recorded as a failed attempt.
- Preserve exact full-word scoring, IME-aware highlighting, metrics, sounds, and session progression.
- Preserve the existing 1000px desktop game layout and 474px target strip.

## Non-Goals

- Do not show all 100 characters simultaneously.
- Do not add automatic font shrinking or multi-line wrapping.
- Do not change mobile support.
- Do not add a configurable maximum-length setting.
- Do not add a skip action, pagination, persistent preferences, or new dependencies.
- Do not change the result metrics or the meaning of a correct attempt.

## Chosen UX

### Short targets

If the rendered target fits inside the available word viewport, show the complete word centered exactly as today. Do not show left or right overflow indicators.

### Long targets

If the target is wider than the available word viewport:

- Keep the current font size and a single line.
- Translate the target track horizontally instead of truncating its content.
- Keep the active character near 36% of the viewport width when clamping permits it. This leaves a small amount of typed context on the left and more upcoming context on the right.
- Clamp translation to the start and end of the word so no empty space appears before the first character or after the final character.
- Recalculate after the target, input position, composition state, or viewport width changes.
- Respect `prefers-reduced-motion` by disabling the short translation transition.

The active index is the next character to enter. During Korean IME composition, the actively composing character is used instead so the viewport does not jump one character ahead.

### Visibility cues

Reserve a compact counter area on the right side of the existing target strip and render `entered / total`, for example `37 / 100`. The moving word viewport uses the remaining width.

Show a subtle fade and directional marker at each clipped edge:

- Left indicator: earlier characters are outside the viewport.
- Right indicator: later characters are outside the viewport.
- No indicator: that edge of the word is currently visible.

Indicators are decorative and hidden from assistive technology. The existing screen-reader-only complete target remains the accessible target value.

### Character feedback

Preserve the existing target character states:

- Correct committed character: green.
- Incorrect committed character: red and underlined.
- Active Korean IME composition character: yellow.
- Not-yet-entered character: neutral.
- Extra input beyond the target: existing red error marker.

Color remains supplementary; the full target and input stay available to assistive technology, and incorrect characters retain underline styling.

## Submission Behavior

Normalize the target and submitted input with `TypingPracticeLogic.normalizeWord` when calculating progress and deciding whether submission is complete. Use `Array.from` for character counts.

On Enter:

1. Empty normalized input remains a no-op.
2. Active IME composition remains a no-op.
3. If submitted length is shorter than target length, do not score, play a failure sound, reset combo, or advance the queue.
4. Show an inline message such as `63자가 남았습니다.` and retain the input and focus.
5. Clear the message on the next input change or after a successful submission attempt.
6. If submitted length is equal to or longer than target length, use the existing exact scoring path. Same-length mistakes and extra characters remain failed attempts.

This guard prevents the visible window from being mistaken for the whole target while preserving the current ability to correct input before submission.

## Maximum Word Length

Add a shared `MAX_TYPING_WORD_LENGTH` constant with value `100` in the typing-practice configuration or logic module.

`TypingPracticeLogic.prepareQueue` includes normalized words whose character count is between the configured minimum and 100 inclusive. Words over 100 characters are excluded. The maximum is fixed and is not exposed as a setting because it represents the supported Kkutu Korea registration limit.

If filtering leaves no words, preserve the existing blocked-start flow and use `조건에 맞는 100자 이하 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.` in both setup validation and hook loading states.

## Component Boundaries

### `TypingTargetViewport`

Add a focused component under `src/app/mini-game/game/typing-practice/` responsible only for target presentation.

Inputs:

- `target`
- `input`
- `isComposing`

Responsibilities:

- Normalize the target and input consistently with scoring.
- Render per-character feedback from those normalized values.
- Measure the viewport, track, and active character.
- Calculate and apply the clamped horizontal offset.
- Render the entered/total counter and overflow indicators.
- Preserve a screen-reader-only complete target.

It does not score attempts, advance the queue, play sounds, or own session state.

### Pure viewport calculation

Keep the offset calculation in a pure helper that accepts viewport width, track width, active character bounds, and anchor ratio. It returns the clamped translation and left/right overflow flags. This isolates layout policy from DOM measurement and allows deterministic unit tests.

### `useTypingPractice`

Continue owning input and submission state. Add only the incomplete-submission message and the early-Enter guard. The hook remains responsible for clearing that message when input changes, restarting, or moving to the next target.

### `TypingPracticeBody`

Replace the current inline `renderTarget` usage with `TypingTargetViewport` and display the hook's incomplete-submission message near the input. Keep the surrounding target, next-word, session-progress, and live-stat layout unchanged.

## Data Flow

1. `prepareQueue` normalizes uploaded words and excludes words shorter than `settings.minLength`, longer than 100 characters, or outside the selected language.
2. `useTypingPractice` exposes the unchanged complete `targetWord` and current input.
3. `TypingTargetViewport` renders the full target on a translated track; no substring becomes the scoring target.
4. Each input update recalculates the active character and target translation.
5. Enter first checks normalized target and input lengths.
6. Incomplete input produces a remaining-character message without an attempt.
7. Complete-length input follows the existing `scoreAttempt` path against the full target.

## Edge Cases

- A word that exactly fits remains centered and does not move.
- At the start, the first character and upcoming context are visible; only the right indicator appears.
- In the middle, both indicators appear and the active character stays near the anchor.
- At the end, the final characters remain visible; only the left indicator appears.
- A 100-character word is accepted; a 101-character word is filtered out.
- English and mixed-width glyphs use measured pixel bounds, not character-count estimates.
- Korean composition anchors the composing syllable and does not submit prematurely.
- Deleting input moves the viewport backward and updates the remaining count.
- Extra input keeps the end clamped and follows existing failure behavior.
- Resize and browser zoom trigger a new measurement without changing session state.

## Testing

### Pure logic tests

- Include a normalized 100-character word in `prepareQueue`.
- Exclude a normalized 101-character word.
- Calculate zero translation for a fitting target.
- Clamp a long target at its start and show right overflow only.
- Anchor a middle character and show both overflow flags.
- Clamp at the end and show left overflow only.

### Hook tests

- Pressing Enter with a non-empty short input does not add an attempt or advance the target.
- The hook reports the correct remaining character count.
- Editing after an incomplete Enter clears the message.
- Same-length incorrect input still records a failed attempt.
- A complete 100-character exact input records a successful attempt.
- Enter during IME composition remains ignored.

### Component tests

- Short targets render centered with no edge indicators.
- Long targets render all target character nodes rather than a display substring.
- The counter reports normalized entered and total lengths.
- Existing correct, incorrect, composing, neutral, extra-input, and accessibility states remain intact.
- Mocked element measurements produce the expected start, middle, and end translations.

### Verification

- Run focused typing-practice Jest suites.
- Run `npm run test`.
- Run `npm run lint`.
- Run `npx tsc --noEmit --incremental false`.
- Run `git diff --check`.
- Visually verify short, medium, and 100-character targets at the start, middle, and end positions.

## Acceptance Criteria

- Words from the configured minimum length through 100 characters can enter the typing-practice queue.
- Words over 100 characters do not enter the queue.
- A long target stays at the existing readable text size and follows the active input position horizontally.
- The user can always tell that hidden characters remain and can see entered versus total length.
- Typing only the currently visible segment and pressing Enter does not create a failed attempt.
- Exact correctness is still evaluated against the complete normalized target.
- Existing short-word, IME highlighting, metrics, sounds, result, and session progression behavior remains unchanged.
