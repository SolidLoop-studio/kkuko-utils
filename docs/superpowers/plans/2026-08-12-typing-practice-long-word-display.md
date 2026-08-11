# Typing Practice Long-Word Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support typing-practice targets up to 100 characters with a readable, horizontally tracked target viewport and protection against submitting only the visible fragment.

**Architecture:** Keep full-word queueing and scoring in `TypingPracticeLogic` and session behavior in `useTypingPractice`. Add a pure viewport-position helper plus a focused `TypingTargetViewport` component that measures and translates the complete rendered target without changing the scoring value. `TypingPracticeBody` only composes the new viewport and displays the hook's incomplete-submission feedback.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS 3, Jest 30, Testing Library, Korean IME events.

## Global Constraints

- Work on the existing `feat/typing-practice-long-word-display` branch; do not create a Git worktree.
- Accept normalized target words from the configured minimum length through exactly 100 characters.
- Keep the existing 20px target text size, 474px target strip, and 1000px desktop game layout.
- Do not add automatic font shrinking, multi-line wrapping, pagination, skip controls, settings, dependencies, or mobile support.
- The complete normalized target remains the only scoring target; the viewport never passes a substring into scoring.
- Preserve current IME colors, metrics, sounds, results, and queue progression for complete-length submissions.
- Use `Array.from` for character counts and `TypingPracticeLogic.normalizeWord` wherever display progress and scoring completeness must agree.
- Follow TDD for every behavior change and use Conventional Commit messages.

---

## File Structure

- Modify `src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts`: export the 100-character limit and enforce it during queue preparation.
- Create `src/app/mini-game/game/typing-practice/lib/typing-target-viewport.ts`: pure horizontal-offset and overflow calculation.
- Create `src/app/mini-game/game/typing-practice/TypingTargetViewport.tsx`: normalized character rendering, measurement, translation, counter, and edge cues.
- Modify `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts`: incomplete Enter guard and feedback state.
- Modify `src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx`: replace inline rendering and show incomplete-submission feedback.
- Modify `src/app/mini-game/game/Game.tsx`: use the exact 100-character-aware empty-queue message.
- Modify `src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts`: 100/101-character queue boundaries.
- Create `src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts`: deterministic viewport math.
- Create `src/__tests__/mini-game/game/typing-practice/TypingTargetViewport.test.tsx`: target rendering and measured translation.
- Modify `src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx`: incomplete submission, normalized length, and 100-character success.
- Modify `src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx`: body integration and visible warning.
- Modify `src/__tests__/mini-game/game/Game.test.tsx`: exact blocked-start message.

---

### Task 1: Enforce the 100-character queue boundary

**Files:**
- Modify: `src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts:6-41`
- Modify: `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts:83-89`
- Modify: `src/app/mini-game/game/Game.tsx:52-63`
- Test: `src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts:13-46`
- Test: `src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx:253-302`
- Test: `src/__tests__/mini-game/game/Game.test.tsx:97-126`

**Interfaces:**
- Consumes: `TypingPracticeLogic.normalizeWord(word: string): string` and `TypingPracticeSettings.minLength`.
- Produces: `MAX_TYPING_WORD_LENGTH: 100` and a `prepareQueue` result containing only normalized words whose `Array.from(word).length` is between `settings.minLength` and 100 inclusive.

- [ ] **Step 1: Write the failing boundary test**

Add this test to `TypingPracticeLogic.test.ts`:

```ts
it('includes 100-character words and excludes longer words', () => {
    const wordAtLimit = '가'.repeat(100);
    const wordOverLimit = '나'.repeat(101);

    const queue = TypingPracticeLogic.prepareQueue(
        [{ word: wordAtLimit }, { word: wordOverLimit }],
        baseSettings,
    );

    expect(queue).toEqual([wordAtLimit]);
});
```

Update the existing empty-filter assertions in `useTypingPractice.test.tsx` and `Game.test.tsx` to expect the exact copy:

```ts
'조건에 맞는 100자 이하 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.'
```

- [ ] **Step 2: Run the boundary and message tests to verify failure**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx src/__tests__/mini-game/game/Game.test.tsx --runInBand
```

Expected: FAIL because the 101-character word remains in the queue and the application still returns the previous blocked message.

- [ ] **Step 3: Add the maximum constant and filter**

In `TypingPracticeLogic.ts`, export the limit next to the regular expressions:

```ts
export const MAX_TYPING_WORD_LENGTH = 100;
```

Replace the minimum-only filter in `prepareQueue` with:

```ts
.filter((word) => {
    const wordLength = Array.from(word).length;
    return wordLength >= settings.minLength && wordLength <= MAX_TYPING_WORD_LENGTH;
})
```

In both `useTypingPractice.ts` and `Game.tsx`, replace the empty filtered-queue message with:

```ts
'조건에 맞는 100자 이하 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.'
```

- [ ] **Step 4: Run the focused tests to verify success**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx src/__tests__/mini-game/game/Game.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the queue boundary**

```bash
git add src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts src/app/mini-game/game/Game.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx src/__tests__/mini-game/game/Game.test.tsx
git commit -m "feat: limit typing practice words to 100 characters"
```

---

### Task 2: Guard incomplete Enter submissions

**Files:**
- Modify: `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts:13-271`
- Test: `src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx:133-250`

**Interfaces:**
- Consumes: `TypingPracticeLogic.normalizeWord(word: string): string`, the complete `targetWord`, raw `input`, and existing `isComposing` state.
- Produces: `incompleteSubmissionMessage: string | null` from `useTypingPractice`; incomplete normalized input never creates an attempt or advances the queue.

- [ ] **Step 1: Write failing hook tests for incomplete and complete long input**

Add these tests to `useTypingPractice.test.tsx`:

```tsx
it('keeps an incomplete normalized submission on the current target', async () => {
    const { result } = renderHook(() => useTypingPractice(settings));
    await waitFor(() => expect(result.current.targetWord).toBe('가방'));

    act(() => {
        result.current.handleInputChange({ target: { value: '가 ' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
        result.current.handleKeyDown({
            key: 'Enter',
            preventDefault: jest.fn(),
        } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(result.current.targetWord).toBe('가방');
    expect(result.current.input).toBe('가 ');
    expect(result.current.attempts).toHaveLength(0);
    expect(result.current.incompleteSubmissionMessage).toBe('1자가 남았습니다.');
    expect(soundManager.play).not.toHaveBeenCalledWith('fail');

    act(() => {
        result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.incompleteSubmissionMessage).toBeNull();
});

it('scores an exact 100-character submission against the complete target', async () => {
    const longWord = '가'.repeat(100);
    getAllWords.mockResolvedValueOnce([{ word: longWord, theme: '장문' }]);
    const { result } = renderHook(() => useTypingPractice(settings));
    await waitFor(() => expect(result.current.targetWord).toBe(longWord));

    act(() => {
        result.current.handleInputChange({ target: { value: longWord } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
        result.current.handleKeyDown({
            key: 'Enter',
            preventDefault: jest.fn(),
        } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(result.current.attempts).toHaveLength(1);
    expect(result.current.attempts[0]).toMatchObject({
        target: longWord,
        submitted: longWord,
        isCorrect: true,
    });
});
```

- [ ] **Step 2: Run the hook tests to verify failure**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx --runInBand
```

Expected: FAIL because the hook does not expose `incompleteSubmissionMessage` and currently scores and advances the incomplete input.

- [ ] **Step 3: Add incomplete-submission state and guard**

Add state with the other session state:

```ts
const [incompleteSubmissionMessage, setIncompleteSubmissionMessage] = useState<string | null>(null);
```

Reset it in `loadQueue` with the other session fields:

```ts
setIncompleteSubmissionMessage(null);
```

In `submit`, retain the existing state/composition checks, normalize the input, keep the timed deadline check ahead of the length guard, and insert:

```ts
const normalizedTarget = TypingPracticeLogic.normalizeWord(targetWord);
const normalizedInput = TypingPracticeLogic.normalizeWord(input);
if (normalizedInput === '') return;

const remainingCharacters = Array.from(normalizedTarget).length - Array.from(normalizedInput).length;
if (remainingCharacters > 0) {
    setIncompleteSubmissionMessage(`${remainingCharacters}자가 남았습니다.`);
    return;
}

setIncompleteSubmissionMessage(null);
```

Clear stale feedback in `handleInputChange`:

```ts
const nextInput = event.target.value;
setInput(nextInput);
setIncompleteSubmissionMessage(null);
```

Expose the state in the hook return object:

```ts
incompleteSubmissionMessage,
```

- [ ] **Step 4: Run the hook tests to verify success**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx --runInBand
```

Expected: PASS, including the existing same-length incorrect-attempt and IME tests.

- [ ] **Step 5: Commit the submission guard**

```bash
git add src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx
git commit -m "feat: guard incomplete typing submissions"
```

---

### Task 3: Implement deterministic viewport positioning

**Files:**
- Create: `src/app/mini-game/game/typing-practice/lib/typing-target-viewport.ts`
- Create: `src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts`

**Interfaces:**
- Consumes: measured viewport width, complete track width, and active-character bounds in pixels.
- Produces: `calculateTypingTargetViewport(measurement): TypingTargetViewportLayout`, where layout contains `translateX`, `hasHiddenStart`, and `hasHiddenEnd`.

- [ ] **Step 1: Write the failing pure layout tests**

Create `typing-target-viewport.test.ts`:

```ts
import { calculateTypingTargetViewport } from '@/src/app/mini-game/game/typing-practice/lib/typing-target-viewport';

describe('calculateTypingTargetViewport', () => {
    it('keeps a fitting target stationary with no hidden edges', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 300,
            activeLeft: 100,
            activeWidth: 20,
        })).toEqual({
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: false,
        });
    });

    it('clamps a long target at the beginning', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 0,
            activeWidth: 20,
        })).toEqual({
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: true,
        });
    });

    it('anchors a middle character at 36 percent of the viewport', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 1000,
            activeWidth: 20,
        })).toEqual({
            translateX: -866,
            hasHiddenStart: true,
            hasHiddenEnd: true,
        });
    });

    it('clamps a long target at the end', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 1980,
            activeWidth: 20,
        })).toEqual({
            translateX: -1600,
            hasHiddenStart: true,
            hasHiddenEnd: false,
        });
    });
});
```

- [ ] **Step 2: Run the layout test to verify failure**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts --runInBand
```

Expected: FAIL because `typing-target-viewport.ts` does not exist.

- [ ] **Step 3: Implement the pure calculation**

Create `typing-target-viewport.ts`:

```ts
export type TypingTargetViewportMeasurement = {
    viewportWidth: number;
    trackWidth: number;
    activeLeft: number;
    activeWidth: number;
    anchorRatio?: number;
};

export type TypingTargetViewportLayout = {
    translateX: number;
    hasHiddenStart: boolean;
    hasHiddenEnd: boolean;
};

export const TYPING_TARGET_ANCHOR_RATIO = 0.36;

export const calculateTypingTargetViewport = ({
    viewportWidth,
    trackWidth,
    activeLeft,
    activeWidth,
    anchorRatio = TYPING_TARGET_ANCHOR_RATIO,
}: TypingTargetViewportMeasurement): TypingTargetViewportLayout => {
    if (viewportWidth <= 0 || trackWidth <= viewportWidth) {
        return {
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: false,
        };
    }

    const minimumTranslateX = viewportWidth - trackWidth;
    const desiredTranslateX = (viewportWidth * anchorRatio) - (activeLeft + activeWidth / 2);
    const translateX = Math.min(0, Math.max(minimumTranslateX, desiredTranslateX));

    return {
        translateX,
        hasHiddenStart: translateX < 0,
        hasHiddenEnd: trackWidth + translateX > viewportWidth,
    };
};
```

- [ ] **Step 4: Run the layout tests to verify success**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the pure viewport helper**

```bash
git add src/app/mini-game/game/typing-practice/lib/typing-target-viewport.ts src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts
git commit -m "feat: calculate typing target viewport position"
```

---

### Task 4: Render and measure the scrolling target viewport

**Files:**
- Create: `src/app/mini-game/game/typing-practice/TypingTargetViewport.tsx`
- Create: `src/__tests__/mini-game/game/typing-practice/TypingTargetViewport.test.tsx`

**Interfaces:**
- Consumes: `target: string`, `input: string`, `isComposing: boolean`, `TypingPracticeLogic.normalizeWord`, and `calculateTypingTargetViewport`.
- Produces: a complete normalized target track, `data-testid="typing-target-count"`, optional start/end overflow indicators, and an inline `translateX` transform.

- [ ] **Step 1: Write failing component tests**

Create `TypingTargetViewport.test.tsx` with these core tests and the measurement helper:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import TypingTargetViewport from '@/src/app/mini-game/game/typing-practice/TypingTargetViewport';

const setDimension = (element: Element, property: string, value: number) => {
    Object.defineProperty(element, property, { configurable: true, value });
};

describe('TypingTargetViewport', () => {
    it('renders the full normalized target and progress count', () => {
        const target = '가'.repeat(100);
        const { container } = render(
            <TypingTargetViewport target={target} input={'가'.repeat(37)} isComposing={false} />,
        );

        expect(screen.getByText(target)).toHaveClass('sr-only');
        expect(container.querySelectorAll('[data-testid="typing-target-character"]')).toHaveLength(100);
        expect(screen.getByTestId('typing-target-count')).toHaveTextContent('37 / 100');
    });

    it('preserves committed mismatch and active composition colors', () => {
        const { container } = render(
            <TypingTargetViewport target="단순누진율" input="단수누" isComposing />,
        );
        const characters = container.querySelectorAll('[data-testid="typing-target-character"]');

        expect(characters[0]).toHaveClass('text-green-300');
        expect(characters[1]).toHaveClass('text-red-300', 'underline');
        expect(characters[2]).toHaveClass('text-yellow-200');
    });

    it('centers a fitting target without hidden-edge indicators', () => {
        render(<TypingTargetViewport target="가방" input="" isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[0];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 100);
        setDimension(active, 'offsetLeft', 0);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(viewport).toHaveClass('text-center');
        expect(track).toHaveStyle({ transform: 'translateX(0px)' });
        expect(screen.queryByTestId('typing-target-overflow-start')).not.toBeInTheDocument();
        expect(screen.queryByTestId('typing-target-overflow-end')).not.toBeInTheDocument();
    });

    it('clamps a long target at the start with only the end indicator', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input="" isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[0];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 0);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(0px)' });
        expect(screen.queryByTestId('typing-target-overflow-start')).not.toBeInTheDocument();
        expect(screen.getByTestId('typing-target-overflow-end')).toBeInTheDocument();
    });

    it('moves a long target and exposes both hidden-edge indicators', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input={'가'.repeat(50)} isComposing={false} />);

        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[50];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 1000);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(-866px)' });
        expect(screen.getByTestId('typing-target-overflow-start')).toBeInTheDocument();
        expect(screen.getByTestId('typing-target-overflow-end')).toBeInTheDocument();
    });

    it('clamps a long target at the end with only the start indicator', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input={target} isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[99];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 1980);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(-1600px)' });
        expect(screen.getByTestId('typing-target-overflow-start')).toBeInTheDocument();
        expect(screen.queryByTestId('typing-target-overflow-end')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the component test to verify failure**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingTargetViewport.test.tsx --runInBand
```

Expected: FAIL because `TypingTargetViewport.tsx` does not exist.

- [ ] **Step 3: Implement the focused viewport component**

Create `TypingTargetViewport.tsx` with this structure:

```tsx
"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TypingPracticeLogic } from './lib/TypingPracticeLogic';
import {
    calculateTypingTargetViewport,
    type TypingTargetViewportLayout,
} from './lib/typing-target-viewport';

type Props = {
    target: string;
    input: string;
    isComposing: boolean;
};

const initialLayout: TypingTargetViewportLayout = {
    translateX: 0,
    hasHiddenStart: false,
    hasHiddenEnd: false,
};

const TypingTargetViewport = ({ target, input, isComposing }: Props) => {
    const normalizedTarget = TypingPracticeLogic.normalizeWord(target);
    const normalizedInput = TypingPracticeLogic.normalizeWord(input);
    const targetCharacters = useMemo(() => Array.from(normalizedTarget), [normalizedTarget]);
    const inputCharacters = useMemo(() => Array.from(normalizedInput), [normalizedInput]);
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<TypingTargetViewportLayout>(initialLayout);
    const activeIndex = Math.min(
        isComposing ? Math.max(inputCharacters.length - 1, 0) : inputCharacters.length,
        Math.max(targetCharacters.length - 1, 0),
    );

    const measure = useCallback(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;
        const activeCharacter = track?.children.item(activeIndex) as HTMLElement | null;
        if (!viewport || !track || !activeCharacter) {
            setLayout(initialLayout);
            return;
        }

        setLayout(calculateTypingTargetViewport({
            viewportWidth: viewport.clientWidth,
            trackWidth: track.scrollWidth,
            activeLeft: activeCharacter.offsetLeft,
            activeWidth: activeCharacter.offsetWidth,
        }));
    }, [activeIndex]);

    useLayoutEffect(() => {
        measure();
        const observer = new ResizeObserver(measure);
        if (viewportRef.current) observer.observe(viewportRef.current);
        if (trackRef.current) observer.observe(trackRef.current);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure, normalizedTarget]);

    const activeComposingIndex = isComposing ? inputCharacters.length - 1 : -1;
    const hasExtraInput = inputCharacters.length > targetCharacters.length;
    const isOverflowing = layout.hasHiddenStart || layout.hasHiddenEnd;

    return (
        <div className="flex h-full w-full items-center gap-2">
            <div
                ref={viewportRef}
                data-testid="typing-target-viewport"
                className={`relative min-w-0 flex-1 overflow-hidden ${isOverflowing ? 'text-left' : 'text-center'}`}
            >
                {layout.hasHiddenStart && (
                    <span data-testid="typing-target-overflow-start" aria-hidden="true" className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-black/70 to-transparent pr-5">‹</span>
                )}
                <div
                    ref={trackRef}
                    data-testid="typing-target-track"
                    className="inline-flex whitespace-nowrap transition-transform motion-reduce:transition-none"
                    style={{ transform: `translateX(${layout.translateX}px)` }}
                >
                    <span className="sr-only">{normalizedTarget}</span>
                    {targetCharacters.map((char, index) => {
                        const typed = inputCharacters[index];
                        const className = typed === undefined
                            ? 'text-[#EEEEEE]'
                            : isComposing && index === activeComposingIndex
                                ? 'text-yellow-200'
                                : typed === char
                                    ? 'text-green-300'
                                    : 'text-red-300 underline';
                        return <span key={`${char}-${index}`} data-testid="typing-target-character" className={className} aria-hidden="true">{char}</span>;
                    })}
                    {hasExtraInput && <span className="text-red-300 underline" aria-hidden="true">!</span>}
                </div>
                {layout.hasHiddenEnd && (
                    <span data-testid="typing-target-overflow-end" aria-hidden="true" className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-black/70 to-transparent pl-5">›</span>
                )}
            </div>
            <span data-testid="typing-target-count" className="w-[66px] shrink-0 text-right text-[12px] text-[#EEEEEE]">
                {inputCharacters.length} / {targetCharacters.length}
            </span>
        </div>
    );
};

export default TypingTargetViewport;
```

- [ ] **Step 4: Run component and helper tests to verify success**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/typing-target-viewport.test.ts src/__tests__/mini-game/game/typing-practice/TypingTargetViewport.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the target viewport**

```bash
git add src/app/mini-game/game/typing-practice/TypingTargetViewport.tsx src/__tests__/mini-game/game/typing-practice/TypingTargetViewport.test.tsx
git commit -m "feat: add scrolling typing target viewport"
```

---

### Task 5: Integrate the viewport and incomplete feedback

**Files:**
- Modify: `src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx:3-159`
- Modify: `src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx:28-188`

**Interfaces:**
- Consumes: `TypingTargetViewport` and `practice.incompleteSubmissionMessage` from Tasks 2 and 4.
- Produces: the final in-game target strip and an `aria-live` incomplete-input message near `GameInput`.

- [ ] **Step 1: Write the failing body integration test**

Add this test to `TypingPracticeBody.test.tsx`:

```tsx
it('keeps a partial visible fragment on a 100-character target', async () => {
    const longWord = '가'.repeat(100);
    getAllWords.mockResolvedValueOnce([{ word: longWord, theme: '장문' }]);
    const { container } = render(
        <TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />,
    );
    const input = await screen.findByRole('textbox');
    await screen.findByText(longWord);

    fireEvent.change(input, { target: { value: '가'.repeat(40) } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('가'.repeat(40));
    expect(screen.getByRole('status')).toHaveTextContent('60자가 남았습니다.');
    expect(screen.getByTestId('typing-target-count')).toHaveTextContent('40 / 100');
    expect(container.querySelectorAll('[data-testid="typing-target-character"]')).toHaveLength(100);
    expect(screen.queryByRole('dialog', { name: '타자 연습 결과' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the body test to verify failure**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx --runInBand
```

Expected: FAIL because the body still uses inline clipped rendering and has no status message.

- [ ] **Step 3: Replace inline target rendering with the component**

In `TypingPracticeBody.tsx`, import the component:

```ts
import TypingTargetViewport from './TypingTargetViewport';
```

Delete the local `renderTarget` function. Replace the target-strip contents with:

```tsx
{practice.isStarting ? (
    <div className="flex h-full items-center justify-center">{practice.displayWord}</div>
) : practice.targetWord ? (
    <TypingTargetViewport
        target={practice.targetWord}
        input={practice.input}
        isComposing={practice.isComposing}
    />
) : (
    <div className="flex h-full items-center justify-center">단어를 불러오는 중...</div>
)}
```

Keep the existing target strip width, height, font size, background, and `overflow-hidden`, but remove `text-center` and `text-ellipsis` because `TypingTargetViewport` owns alignment and overflow cues.

- [ ] **Step 4: Render stable inline feedback near the input**

Immediately after `GameInput`, add:

```tsx
<p
    role="status"
    aria-live="polite"
    className="min-h-[20px] w-[460px] pt-1 text-center text-sm text-yellow-700 dark:text-yellow-200"
>
    {practice.incompleteSubmissionMessage ?? ''}
</p>
```

Keep the live-stat strip's existing `mt-2` class after the fixed-height status row.

- [ ] **Step 5: Run body and hook tests to verify success**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx --runInBand
```

Expected: PASS, including the existing accessibility and Korean IME highlighting tests.

- [ ] **Step 6: Commit body integration**

```bash
git add src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx
git commit -m "feat: integrate long-word typing feedback"
```

---

### Task 6: Run full regression and visual verification

**Files:**
- Verify only; change production or test files solely to correct failures caused by Tasks 1-5.

**Interfaces:**
- Consumes: all deliverables from Tasks 1-5.
- Produces: verified branch state with no staged or tracked uncommitted changes.

- [ ] **Step 1: Run all typing-practice tests**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice src/__tests__/mini-game/game/Game.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the full Jest suite**

Run:

```bash
npm run test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run lint and TypeScript checks**

Run:

```bash
npm run lint
npx tsc --noEmit --incremental false
```

Expected: both commands exit with status 0.

- [ ] **Step 4: Check patch hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints nothing. `git status --short` lists only the conversation mockup directories `.codex/` and `.superpowers/`; no tracked implementation files remain modified.

- [ ] **Step 5: Visually inspect real layout states**

Run:

```bash
npm run dev
```

In `/mini-game`, upload a list containing 2-character, 30-character, and 100-character Korean targets. Verify these exact states:

- Short word: centered, `0 / 2`, no edge cues.
- 100-character word at index 0: readable size, right cue only.
- 100-character word near index 50: active character near 36%, both cues.
- 100-character word at index 100: final characters visible, left cue only.
- Partial Enter: input and target remain, status reports the exact remainder, no failure sound.
- Full exact Enter: success sound, metrics, combo, and queue progression remain correct.
- Korean IME mismatch: committed mismatch stays red/underlined while only the composing syllable is yellow.

- [ ] **Step 6: Commit any verification-only corrections**

If Tasks 1-5 required a correction during full verification, stage only the files changed for that correction and commit:

```bash
git add src/app/mini-game/game src/__tests__/mini-game/game
git commit -m "fix: correct long-word typing regressions"
```

If no correction was needed, do not create an empty commit.
