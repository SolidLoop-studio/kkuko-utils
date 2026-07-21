# Typing Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/mini-game` typing-practice mode that reuses uploaded words and measures WPM, characters per minute, accuracy, and combo.

**Architecture:** Keep the existing word-chain game loop isolated. Add a `typing-practice` module with pure metric/queue logic, a React hook for session orchestration, and UI components that reuse the existing mini-game shell and input styling. Share `wordDB.ts` for uploaded words and keep Redux limited to screen-level play/start state.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Redux Toolkit, IndexedDB via `idb`, Jest, Testing Library, Tailwind CSS, lucide-react.

## Global Constraints

- `/mini-game` remains the single entry point.
- Do not build 제시어 대응 훈련.
- Do not save typing records to Supabase or user accounts in the first version.
- Do not add ranking, achievements, multiplayer, or daily challenges.
- Do not change the word-chain game rules, hint behavior, chat command behavior, or `GameManager` semantics.
- Store selected practice type in `localStorage` key `kkutu_practice_type`.
- Store typing-practice settings in `localStorage` key `kkutu_typing_practice_setting`.
- Keep typing-practice behavior out of `GameManager`, `GameLogic`, and `useGameLogic`.
- Accuracy is based on submitted text, not every physical keypress.
- Timing starts when the typing-practice body enters active state.
- Failed non-empty submissions advance to the next target and reset combo.
- Chat remains visible for layout consistency, but `GameInput` owns typing-practice submissions.
- Mobile remains unsupported for `/mini-game`.

---

## File Structure

- Create `src/app/mini-game/game/typing-practice/types/typing-practice.types.ts`
  - Defines settings, attempts, metrics, and session mode types.
- Create `src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts`
  - Pure functions for word normalization, filtering, queue creation, per-attempt scoring, aggregate metrics, and combo updates.
- Create `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts`
  - Loads words from IndexedDB, owns active session state, timer, IME composition state, submissions, and result modal state.
- Create `src/app/mini-game/game/typing-practice/TypingPracticeSettings.tsx`
  - Setup controls for session type, duration/count, language filter, word order, and minimum length.
- Create `src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx`
  - Main typing-practice play screen using existing mini-game visual patterns.
- Create `src/app/mini-game/game/typing-practice/TypingPracticeResultModal.tsx`
  - Session result summary modal.
- Modify `src/app/mini-game/game/GameSetup.tsx`
  - Add practice-type selector and render typing settings when selected.
- Modify `src/app/mini-game/game/Game.tsx`
  - Choose between `GameBody` and `TypingPracticeBody` while preserving `KkutuMenu`, `GameBox`, and chat.
- Modify `src/app/mini-game/game/components/KkutuMenu.tsx`
  - Block typing-practice start with the existing start-blocked modal when no words are uploaded.
- Modify `src/app/mini-game/game/components/GameInput.tsx`
  - Add optional IME composition handlers without changing existing consumers.
- Modify `src/app/mini-game/game/components/HelpModal.tsx`
  - Add concise 타자 연습 help.
- Add tests under `src/__tests__/mini-game/game/typing-practice/`.

---

### Task 1: Typing Practice Pure Logic

**Files:**
- Create: `src/app/mini-game/game/typing-practice/types/typing-practice.types.ts`
- Create: `src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts`
- Test: `src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts`

**Interfaces:**
- Consumes: raw words shaped as `{ word: string; theme?: string }[]`.
- Produces:
  - `TypingPracticeSettings`
  - `TypingPracticeAttempt`
  - `TypingPracticeMetrics`
  - `TypingPracticeLogic.normalizeWord(word: string): string`
  - `TypingPracticeLogic.prepareQueue(words, settings, random?): string[]`
  - `TypingPracticeLogic.scoreAttempt(target, submitted): TypingPracticeAttempt`
  - `TypingPracticeLogic.calculateMetrics(attempts, elapsedMs, currentCombo, maxCombo): TypingPracticeMetrics`
  - `TypingPracticeLogic.nextCombo(attempt, currentCombo, maxCombo): { combo: number; maxCombo: number }`

- [ ] **Step 1: Write failing pure-logic tests**

Create `src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts`:

```ts
import { TypingPracticeLogic } from '@/src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic';
import type { TypingPracticeSettings } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

const baseSettings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 10,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('TypingPracticeLogic', () => {
    it('normalizes words like the mini-game word service', () => {
        expect(TypingPracticeLogic.normalizeWord('  Apple!! ')).toBe('apple');
        expect(TypingPracticeLogic.normalizeWord('가-나_다')).toBe('가나다');
        expect(TypingPracticeLogic.normalizeWord('ㄱㄴ word')).toBe('ㄱㄴword');
    });

    it('filters and sorts Korean words', () => {
        const queue = TypingPracticeLogic.prepareQueue(
            [{ word: 'banana' }, { word: '가방' }, { word: '나무' }, { word: 'a' }],
            { ...baseSettings, language: 'ko', order: 'sorted', minLength: 2 },
        );

        expect(queue).toEqual(['가방', '나무']);
    });

    it('filters English words and caps fixed-count queue length', () => {
        const queue = TypingPracticeLogic.prepareQueue(
            [{ word: 'banana' }, { word: 'apple' }, { word: '가방' }],
            { ...baseSettings, language: 'en', order: 'sorted', wordCount: 1 },
        );

        expect(queue).toEqual(['apple']);
    });

    it('random order keeps the same words without duplicates when random is deterministic', () => {
        const queue = TypingPracticeLogic.prepareQueue(
            [{ word: '가방' }, { word: '나무' }, { word: '다리' }],
            { ...baseSettings, order: 'random', wordCount: 3 },
            () => 0.99,
        );

        expect(queue.sort((a, b) => a.localeCompare(b, 'ko'))).toEqual(['가방', '나무', '다리']);
    });

    it('scores exact, partial, shorter, and longer submissions', () => {
        expect(TypingPracticeLogic.scoreAttempt('가방', '가방')).toMatchObject({
            target: '가방',
            submitted: '가방',
            isCorrect: true,
            correctCharacters: 2,
            submittedCharacters: 2,
        });

        expect(TypingPracticeLogic.scoreAttempt('가방', '가자')).toMatchObject({
            isCorrect: false,
            correctCharacters: 1,
            submittedCharacters: 2,
        });

        expect(TypingPracticeLogic.scoreAttempt('apple', 'app')).toMatchObject({
            isCorrect: false,
            correctCharacters: 3,
            submittedCharacters: 3,
        });

        expect(TypingPracticeLogic.scoreAttempt('app', 'apple')).toMatchObject({
            isCorrect: false,
            correctCharacters: 3,
            submittedCharacters: 5,
        });
    });

    it('calculates metrics with elapsed time clamped to at least one second', () => {
        const attempts = [
            TypingPracticeLogic.scoreAttempt('apple', 'apple'),
            TypingPracticeLogic.scoreAttempt('가방', '가자'),
        ];

        const metrics = TypingPracticeLogic.calculateMetrics(attempts, 0, 0, 1);

        expect(metrics.correctCharacters).toBe(6);
        expect(metrics.totalSubmittedCharacters).toBe(7);
        expect(metrics.accuracy).toBeCloseTo((6 / 7) * 100, 4);
        expect(metrics.wpm).toBeCloseTo(72, 4);
        expect(metrics.charactersPerMinute).toBeCloseTo(360, 4);
        expect(metrics.completedWords).toBe(1);
        expect(metrics.failedWords).toBe(1);
    });

    it('updates combo and max combo from attempt correctness', () => {
        const correct = TypingPracticeLogic.scoreAttempt('가방', '가방');
        const fail = TypingPracticeLogic.scoreAttempt('나무', '나비');

        expect(TypingPracticeLogic.nextCombo(correct, 2, 2)).toEqual({ combo: 3, maxCombo: 3 });
        expect(TypingPracticeLogic.nextCombo(fail, 3, 3)).toEqual({ combo: 0, maxCombo: 3 });
    });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts`

Expected: FAIL because `TypingPracticeLogic` and typing-practice types do not exist.

- [ ] **Step 3: Add types**

Create `src/app/mini-game/game/typing-practice/types/typing-practice.types.ts`:

```ts
export type TypingPracticeSessionMode = 'timed' | 'fixed-count';
export type TypingPracticeLanguage = 'ko' | 'en' | 'all';
export type TypingPracticeOrder = 'random' | 'sorted';

export type TypingPracticeSettings = {
    sessionMode: TypingPracticeSessionMode;
    durationSeconds: 30 | 60 | 120;
    wordCount: 10 | 25 | 50;
    language: TypingPracticeLanguage;
    order: TypingPracticeOrder;
    minLength: number;
};

export type TypingPracticeAttempt = {
    target: string;
    submitted: string;
    isCorrect: boolean;
    correctCharacters: number;
    submittedCharacters: number;
    completedAt: number;
};

export type TypingPracticeMetrics = {
    correctCharacters: number;
    totalSubmittedCharacters: number;
    accuracy: number;
    wpm: number;
    charactersPerMinute: number;
    completedWords: number;
    failedWords: number;
    totalAttempts: number;
    averageWordTime: number;
    combo: number;
    maxCombo: number;
    elapsedMs: number;
};
```

- [ ] **Step 4: Add pure logic**

Create `src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts`:

```ts
import type {
    TypingPracticeAttempt,
    TypingPracticeMetrics,
    TypingPracticeSettings,
} from '../types/typing-practice.types';

const KOREAN_START = /^[가-힣ㄱ-ㅎ]/;
const ENGLISH_START = /^[a-zA-Z]/;
const WORD_PATTERN = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;

export class TypingPracticeLogic {
    public static normalizeWord(word: string): string {
        return word.replace(WORD_PATTERN, '').toLowerCase();
    }

    public static prepareQueue(
        words: Array<{ word: string }>,
        settings: TypingPracticeSettings,
        random: () => number = Math.random,
    ): string[] {
        const filtered = words
            .map((entry) => this.normalizeWord(entry.word))
            .filter((word) => word.length >= settings.minLength)
            .filter((word) => {
                if (settings.language === 'ko') return KOREAN_START.test(word);
                if (settings.language === 'en') return ENGLISH_START.test(word);
                return KOREAN_START.test(word) || ENGLISH_START.test(word);
            });

        const ordered = settings.order === 'sorted'
            ? [...filtered].sort((a, b) => a.localeCompare(b, 'ko'))
            : this.shuffle(filtered, random);

        if (settings.sessionMode === 'fixed-count') {
            return ordered.slice(0, settings.wordCount);
        }

        return ordered;
    }

    public static scoreAttempt(target: string, submitted: string, completedAt = Date.now()): TypingPracticeAttempt {
        const correctCharacters = Array.from(submitted).reduce((count, char, index) => {
            return count + (Array.from(target)[index] === char ? 1 : 0);
        }, 0);

        return {
            target,
            submitted,
            isCorrect: target === submitted,
            correctCharacters,
            submittedCharacters: Array.from(submitted).length,
            completedAt,
        };
    }

    public static nextCombo(
        attempt: TypingPracticeAttempt,
        currentCombo: number,
        maxCombo: number,
    ): { combo: number; maxCombo: number } {
        if (!attempt.isCorrect) {
            return { combo: 0, maxCombo };
        }

        const combo = currentCombo + 1;
        return { combo, maxCombo: Math.max(maxCombo, combo) };
    }

    public static calculateMetrics(
        attempts: TypingPracticeAttempt[],
        elapsedMs: number,
        combo: number,
        maxCombo: number,
    ): TypingPracticeMetrics {
        const safeElapsedMs = Math.max(elapsedMs, 1000);
        const elapsedMinutes = safeElapsedMs / 60000;
        const correctCharacters = attempts.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
        const totalSubmittedCharacters = attempts.reduce((sum, attempt) => sum + attempt.submittedCharacters, 0);
        const completedWords = attempts.filter((attempt) => attempt.isCorrect).length;
        const failedWords = attempts.length - completedWords;

        return {
            correctCharacters,
            totalSubmittedCharacters,
            accuracy: (correctCharacters / Math.max(totalSubmittedCharacters, 1)) * 100,
            wpm: correctCharacters / 5 / elapsedMinutes,
            charactersPerMinute: correctCharacters / elapsedMinutes,
            completedWords,
            failedWords,
            totalAttempts: attempts.length,
            averageWordTime: attempts.length > 0 ? safeElapsedMs / attempts.length : 0,
            combo,
            maxCombo,
            elapsedMs: safeElapsedMs,
        };
    }

    private static shuffle(words: string[], random: () => number): string[] {
        const result = [...words];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }
}
```

- [ ] **Step 5: Run logic tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/mini-game/game/typing-practice/types/typing-practice.types.ts src/app/mini-game/game/typing-practice/lib/TypingPracticeLogic.ts src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts
git commit -m "feat: add typing practice logic"
```

---

### Task 2: Practice Type and Settings in Setup

**Files:**
- Modify: `src/app/mini-game/game/GameSetup.tsx`
- Create: `src/app/mini-game/game/typing-practice/TypingPracticeSettings.tsx`
- Test: `src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx`
- Test: `src/__tests__/mini-game/game/GameSetup.test.tsx`

**Interfaces:**
- Consumes: `TypingPracticeSettings` from Task 1.
- Produces:
  - exported constants `PRACTICE_TYPE_STORAGE_KEY = 'kkutu_practice_type'`
  - exported constants `TYPING_SETTING_STORAGE_KEY = 'kkutu_typing_practice_setting'`
  - `TypingPracticeSettingsPanel` component with props:

```ts
type TypingPracticeSettingsPanelProps = {
    value: TypingPracticeSettings;
    onChange: (next: TypingPracticeSettings) => void;
};
```

- [ ] **Step 1: Write failing settings tests**

Create `src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeSettingsPanel from '@/src/app/mini-game/game/typing-practice/TypingPracticeSettings';
import type { TypingPracticeSettings } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

const value: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};

describe('TypingPracticeSettingsPanel', () => {
    it('updates duration, language, order, and minimum length', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();

        render(<TypingPracticeSettingsPanel value={value} onChange={onChange} />);

        await user.selectOptions(screen.getByLabelText('연습 시간'), '120');
        expect(onChange).toHaveBeenCalledWith({ ...value, sessionMode: 'timed', durationSeconds: 120 });

        await user.selectOptions(screen.getByLabelText('언어'), 'ko');
        expect(onChange).toHaveBeenCalledWith({ ...value, language: 'ko' });

        await user.selectOptions(screen.getByLabelText('단어 순서'), 'sorted');
        expect(onChange).toHaveBeenCalledWith({ ...value, order: 'sorted' });

        await user.clear(screen.getByLabelText('최소 글자 수'));
        await user.type(screen.getByLabelText('최소 글자 수'), '4');
        expect(onChange).toHaveBeenLastCalledWith({ ...value, minLength: 4 });
    });
});
```

Extend `src/__tests__/mini-game/game/GameSetup.test.tsx` with:

```tsx
it('persists typing practice as the selected practice type', async () => {
    const user = userEvent.setup();
    render(<GameSetup />);

    await user.click(screen.getByRole('radio', { name: '타자 연습' }));

    expect(localStorage.getItem('kkutu_practice_type')).toBe('typing-practice');
    expect(screen.getByText('타자 연습 설정')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx src/__tests__/mini-game/game/GameSetup.test.tsx`

Expected: FAIL because `TypingPracticeSettingsPanel` and setup radio controls do not exist.

- [ ] **Step 3: Add typing settings component**

Create `src/app/mini-game/game/typing-practice/TypingPracticeSettings.tsx`:

```tsx
"use client";

import React from 'react';
import type { TypingPracticeSettings } from './types/typing-practice.types';

type TypingPracticeSettingsPanelProps = {
    value: TypingPracticeSettings;
    onChange: (next: TypingPracticeSettings) => void;
};

const TypingPracticeSettingsPanel = ({ value, onChange }: TypingPracticeSettingsPanelProps) => {
    const update = (partial: Partial<TypingPracticeSettings>) => {
        onChange({ ...value, ...partial });
    };

    return (
        <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">타자 연습 설정</h2>

            <div>
                <label htmlFor="typing-session-mode" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">세션 방식</label>
                <select
                    id="typing-session-mode"
                    value={value.sessionMode}
                    onChange={(event) => update({ sessionMode: event.target.value as TypingPracticeSettings['sessionMode'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="timed">시간 제한</option>
                    <option value="fixed-count">단어 수 제한</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-duration" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">연습 시간</label>
                <select
                    id="typing-duration"
                    value={value.durationSeconds}
                    onChange={(event) => update({ sessionMode: 'timed', durationSeconds: Number(event.target.value) as TypingPracticeSettings['durationSeconds'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value={30}>30초</option>
                    <option value={60}>60초</option>
                    <option value={120}>120초</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-word-count" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">단어 수</label>
                <select
                    id="typing-word-count"
                    value={value.wordCount}
                    onChange={(event) => update({ sessionMode: 'fixed-count', wordCount: Number(event.target.value) as TypingPracticeSettings['wordCount'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value={10}>10개</option>
                    <option value={25}>25개</option>
                    <option value={50}>50개</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-language" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">언어</label>
                <select
                    id="typing-language"
                    value={value.language}
                    onChange={(event) => update({ language: event.target.value as TypingPracticeSettings['language'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="all">전체</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-order" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">단어 순서</label>
                <select
                    id="typing-order"
                    value={value.order}
                    onChange={(event) => update({ order: event.target.value as TypingPracticeSettings['order'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="random">랜덤</option>
                    <option value="sorted">가나다순</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-min-length" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">최소 글자 수</label>
                <input
                    id="typing-min-length"
                    type="number"
                    min={2}
                    max={10}
                    value={value.minLength}
                    onChange={(event) => update({ minLength: Math.min(10, Math.max(2, Number(event.target.value) || 2)) })}
                    className="w-full px-3 py-2 border rounded-lg"
                />
            </div>
        </div>
    );
};

export default TypingPracticeSettingsPanel;
```

- [ ] **Step 4: Add setup state and persistence**

Modify `src/app/mini-game/game/GameSetup.tsx`:

```tsx
import TypingPracticeSettingsPanel from './typing-practice/TypingPracticeSettings';
import type { TypingPracticeSettings } from './typing-practice/types/typing-practice.types';

export const PRACTICE_TYPE_STORAGE_KEY = 'kkutu_practice_type';
export const TYPING_SETTING_STORAGE_KEY = 'kkutu_typing_practice_setting';

type PracticeType = 'word-chain' | 'typing-practice';

const defaultTypingPracticeSetting: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};
```

Inside `GameSetup`, add state:

```tsx
const [practiceType, setPracticeType] = useState<PracticeType>('word-chain');
const [typingPracticeSetting, setTypingPracticeSetting] = useState<TypingPracticeSettings>(defaultTypingPracticeSetting);
```

Inside the mount effect path, load both values:

```tsx
const loadPracticeType = () => {
    try {
        const raw = localStorage.getItem(PRACTICE_TYPE_STORAGE_KEY);
        setPracticeType(raw === 'typing-practice' ? 'typing-practice' : 'word-chain');
    } catch (e) {
        console.error(e);
    }
};

const loadTypingPracticeSetting = () => {
    try {
        const raw = localStorage.getItem(TYPING_SETTING_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setTypingPracticeSetting({
            sessionMode: parsed.sessionMode === 'fixed-count' ? 'fixed-count' : 'timed',
            durationSeconds: [30, 60, 120].includes(parsed.durationSeconds) ? parsed.durationSeconds : 60,
            wordCount: [10, 25, 50].includes(parsed.wordCount) ? parsed.wordCount : 25,
            language: ['ko', 'en', 'all'].includes(parsed.language) ? parsed.language : 'all',
            order: parsed.order === 'sorted' ? 'sorted' : 'random',
            minLength: Math.min(10, Math.max(2, Number(parsed.minLength) || 2)),
        });
    } catch (e) {
        console.error(e);
    }
};

const handlePracticeTypeChange = (next: PracticeType) => {
    setPracticeType(next);
    try {
        localStorage.setItem(PRACTICE_TYPE_STORAGE_KEY, next);
    } catch (e) {
        console.error(e);
    }
};

const handleTypingPracticeSettingChange = (next: TypingPracticeSettings) => {
    setTypingPracticeSetting(next);
    try {
        localStorage.setItem(TYPING_SETTING_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
        console.error(e);
    }
};
```

Add the selector above the settings column:

```tsx
<div className="mb-4">
    <label className="block text-sm text-gray-700 dark:text-gray-200 mb-2">연습 종류</label>
    <div className="flex gap-3">
        <label className="inline-flex items-center gap-2">
            <input
                type="radio"
                name="practiceType"
                checked={practiceType === 'word-chain'}
                onChange={() => handlePracticeTypeChange('word-chain')}
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">단어 연습</span>
        </label>
        <label className="inline-flex items-center gap-2">
            <input
                type="radio"
                name="practiceType"
                checked={practiceType === 'typing-practice'}
                onChange={() => handlePracticeTypeChange('typing-practice')}
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">타자 연습</span>
        </label>
    </div>
</div>
```

Render word-chain settings only when `practiceType === 'word-chain'`, and render:

```tsx
{practiceType === 'typing-practice' && (
    <TypingPracticeSettingsPanel
        value={typingPracticeSetting}
        onChange={handleTypingPracticeSettingChange}
    />
)}
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx src/__tests__/mini-game/game/GameSetup.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/mini-game/game/GameSetup.tsx src/app/mini-game/game/typing-practice/TypingPracticeSettings.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx src/__tests__/mini-game/game/GameSetup.test.tsx
git commit -m "feat: add typing practice setup"
```

---

### Task 3: Typing Practice Session Hook

**Files:**
- Create: `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts`
- Test: `src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx`

**Interfaces:**
- Consumes: `getAllWords()` from `src/app/mini-game/game/lib/wordDB.ts`, `TypingPracticeLogic`, `TypingPracticeSettings`.
- Produces:

```ts
type UseTypingPracticeResult = {
    targetWord: string;
    input: string;
    attempts: TypingPracticeAttempt[];
    metrics: TypingPracticeMetrics;
    progressValue: number;
    progressMax: number;
    isComposing: boolean;
    isFinished: boolean;
    resultOpen: boolean;
    blockedMessage: string | null;
    handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    handleCompositionStart: () => void;
    handleCompositionEnd: () => void;
    restart: () => Promise<void>;
    finish: () => void;
    closeResult: () => void;
};
```

- [ ] **Step 1: Write failing hook tests**

Create `src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTypingPractice } from '@/src/app/mini-game/game/typing-practice/hooks/useTypingPractice';
import type { TypingPracticeSettings } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('@/src/app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn(),
}));

const { getAllWords } = jest.requireMock('@/src/app/mini-game/game/lib/wordDB');

const settings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 2,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('useTypingPractice', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-07-22T00:00:00Z'));
        getAllWords.mockResolvedValue([
            { word: '가방', theme: '자유' },
            { word: '나무', theme: '자유' },
        ]);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('loads words and renders the first target', async () => {
        const { result } = renderHook(() => useTypingPractice(settings));

        await waitFor(() => expect(result.current.targetWord).toBe('가방'));
        expect(result.current.blockedMessage).toBeNull();
    });

    it('submits correct and incorrect attempts with combo updates', async () => {
        const { result } = renderHook(() => useTypingPractice(settings));
        await waitFor(() => expect(result.current.targetWord).toBe('가방'));

        act(() => {
            result.current.handleInputChange({ target: { value: '가방' } } as React.ChangeEvent<HTMLInputElement>);
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.targetWord).toBe('나무');
        expect(result.current.metrics.combo).toBe(1);

        act(() => {
            result.current.handleInputChange({ target: { value: '나비' } } as React.ChangeEvent<HTMLInputElement>);
            result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>);
        });

        expect(result.current.metrics.combo).toBe(0);
        expect(result.current.isFinished).toBe(true);
        expect(result.current.resultOpen).toBe(true);
    });

    it('blocks when filters remove all words', async () => {
        getAllWords.mockResolvedValue([{ word: 'apple', theme: '자유' }]);

        const { result } = renderHook(() => useTypingPractice({ ...settings, language: 'ko' }));

        await waitFor(() => expect(result.current.blockedMessage).toBe('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.'));
    });
});
```

- [ ] **Step 2: Run failing hook tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx`

Expected: FAIL because `useTypingPractice` does not exist.

- [ ] **Step 3: Implement hook**

Create `src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllWords } from '../../lib/wordDB';
import { TypingPracticeLogic } from '../lib/TypingPracticeLogic';
import type {
    TypingPracticeAttempt,
    TypingPracticeMetrics,
    TypingPracticeSettings,
} from '../types/typing-practice.types';

const EMPTY_METRICS: TypingPracticeMetrics = {
    correctCharacters: 0,
    totalSubmittedCharacters: 0,
    accuracy: 0,
    wpm: 0,
    charactersPerMinute: 0,
    completedWords: 0,
    failedWords: 0,
    totalAttempts: 0,
    averageWordTime: 0,
    combo: 0,
    maxCombo: 0,
    elapsedMs: 1000,
};

export const useTypingPractice = (settings: TypingPracticeSettings) => {
    const [queue, setQueue] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState('');
    const [attempts, setAttempts] = useState<TypingPracticeAttempt[]>([]);
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [startedAt, setStartedAt] = useState(() => Date.now());
    const [isComposing, setIsComposing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [resultOpen, setResultOpen] = useState(false);
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const loadQueue = useCallback(async () => {
        const words = await getAllWords();
        const nextQueue = TypingPracticeLogic.prepareQueue(words, settings);
        if (nextQueue.length === 0) {
            setBlockedMessage('조건에 맞는 단어가 없습니다. 언어나 최소 글자 수를 조정해주세요.');
            setQueue([]);
            return;
        }

        setBlockedMessage(null);
        setQueue(nextQueue);
        setCurrentIndex(0);
        setInput('');
        setAttempts([]);
        setCombo(0);
        setMaxCombo(0);
        setStartedAt(Date.now());
        setNow(Date.now());
        setIsFinished(false);
        setResultOpen(false);
    }, [settings]);

    useEffect(() => {
        void loadQueue();
    }, [loadQueue]);

    useEffect(() => {
        if (isFinished || blockedMessage) return;
        timerRef.current = setInterval(() => setNow(Date.now()), 250);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isFinished, blockedMessage]);

    const elapsedMs = Math.max(now - startedAt, 1000);
    const targetWord = queue[currentIndex] ?? '';
    const metrics = useMemo(
        () => TypingPracticeLogic.calculateMetrics(attempts, elapsedMs, combo, maxCombo),
        [attempts, elapsedMs, combo, maxCombo],
    );

    const finish = useCallback(() => {
        setIsFinished(true);
        setResultOpen(true);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (settings.sessionMode === 'timed' && elapsedMs >= settings.durationSeconds * 1000) {
            finish();
        }
    }, [elapsedMs, finish, settings.durationSeconds, settings.sessionMode]);

    const submit = useCallback(() => {
        if (!targetWord || input.trim() === '' || isFinished || isComposing) return;

        const attempt = TypingPracticeLogic.scoreAttempt(targetWord, input);
        const nextCombo = TypingPracticeLogic.nextCombo(attempt, combo, maxCombo);
        const nextAttempts = [...attempts, attempt];
        const nextIndex = currentIndex + 1;

        setAttempts(nextAttempts);
        setCombo(nextCombo.combo);
        setMaxCombo(nextCombo.maxCombo);
        setInput('');

        const countComplete = settings.sessionMode === 'fixed-count' && nextAttempts.length >= Math.min(settings.wordCount, queue.length);
        const queueComplete = nextIndex >= queue.length;

        if (countComplete || queueComplete) {
            setCurrentIndex(Math.min(nextIndex, queue.length - 1));
            finish();
            return;
        }

        setCurrentIndex(nextIndex);
    }, [attempts, combo, currentIndex, finish, input, isComposing, isFinished, maxCombo, queue.length, settings.sessionMode, settings.wordCount, targetWord]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput(event.target.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    };

    const progressMax = settings.sessionMode === 'timed' ? settings.durationSeconds : Math.min(settings.wordCount, queue.length || settings.wordCount);
    const progressValue = settings.sessionMode === 'timed' ? Math.min(elapsedMs / 1000, settings.durationSeconds) : attempts.length;

    return {
        targetWord,
        input,
        attempts,
        metrics,
        progressValue,
        progressMax,
        isComposing,
        isFinished,
        resultOpen,
        blockedMessage,
        handleInputChange,
        handleKeyDown,
        handleCompositionStart: () => setIsComposing(true),
        handleCompositionEnd: () => setIsComposing(false),
        restart: loadQueue,
        finish,
        closeResult: () => setResultOpen(false),
    };
};
```

- [ ] **Step 4: Run hook tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/mini-game/game/typing-practice/hooks/useTypingPractice.ts src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx
git commit -m "feat: add typing practice session hook"
```

---

### Task 4: Play Screen and Result Modal

**Files:**
- Create: `src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx`
- Create: `src/app/mini-game/game/typing-practice/TypingPracticeResultModal.tsx`
- Modify: `src/app/mini-game/game/components/GameInput.tsx`
- Test: `src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx`

**Interfaces:**
- Consumes: `useTypingPractice(settings)`.
- Produces:
  - `TypingPracticeBody` props: `{ settings: TypingPracticeSettings; onExitToSetup: () => void }`
  - `TypingPracticeResultModal` props: `{ metrics; attempts; onRestart; onExitToSetup; onClose }`

- [ ] **Step 1: Write failing body tests**

Create `src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypingPracticeBody from '@/src/app/mini-game/game/typing-practice/TypingPracticeBody';
import type { TypingPracticeSettings } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

jest.mock('@/src/app/mini-game/game/lib/wordDB', () => ({
    getAllWords: jest.fn().mockResolvedValue([
        { word: '가방', theme: '자유' },
        { word: '나무', theme: '자유' },
    ]),
}));

const settings: TypingPracticeSettings = {
    sessionMode: 'fixed-count',
    durationSeconds: 60,
    wordCount: 2,
    language: 'all',
    order: 'sorted',
    minLength: 2,
};

describe('TypingPracticeBody', () => {
    it('renders target word, live stats, and result modal after fixed count', async () => {
        const user = userEvent.setup();
        render(<TypingPracticeBody settings={settings} onExitToSetup={jest.fn()} />);

        expect(await screen.findByText('가방')).toBeInTheDocument();
        expect(screen.getByText('WPM')).toBeInTheDocument();
        expect(screen.getByText('분당타자수')).toBeInTheDocument();

        await user.type(screen.getByRole('textbox'), '가방{enter}');
        expect(await screen.findByText('나무')).toBeInTheDocument();

        await user.type(screen.getByRole('textbox'), '나비{enter}');
        expect(await screen.findByText('타자 연습 결과')).toBeInTheDocument();
        expect(screen.getByText('최대 콤보')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run failing body tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx`

Expected: FAIL because body and result modal do not exist.

- [ ] **Step 3: Extend `GameInput` with composition handlers**

Modify `src/app/mini-game/game/components/GameInput.tsx` interface:

```tsx
onCompositionStart?: () => void;
onCompositionEnd?: () => void;
```

Pass them to `<input>`:

```tsx
onCompositionStart={onCompositionStart}
onCompositionEnd={onCompositionEnd}
```

Existing consumers continue to work because both props are optional.

- [ ] **Step 4: Add result modal**

Create `src/app/mini-game/game/typing-practice/TypingPracticeResultModal.tsx`:

```tsx
"use client";

import React from 'react';
import type { TypingPracticeAttempt, TypingPracticeMetrics } from './types/typing-practice.types';

type Props = {
    metrics: TypingPracticeMetrics;
    attempts: TypingPracticeAttempt[];
    onRestart: () => void;
    onExitToSetup: () => void;
    onClose: () => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const TypingPracticeResultModal = ({ metrics, attempts, onRestart, onExitToSetup, onClose }: Props) => {
    const recentAttempts = attempts.slice(-5).reverse();

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[560px] p-6" onClick={(event) => event.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">타자 연습 결과</h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-300">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div><div className="text-xs text-gray-500">WPM</div><div className="font-bold">{formatNumber(metrics.wpm)}</div></div>
                    <div><div className="text-xs text-gray-500">분당타자수</div><div className="font-bold">{formatNumber(metrics.charactersPerMinute)}</div></div>
                    <div><div className="text-xs text-gray-500">정확도</div><div className="font-bold">{formatNumber(metrics.accuracy)}%</div></div>
                    <div><div className="text-xs text-gray-500">완료 단어</div><div className="font-bold">{metrics.completedWords}</div></div>
                    <div><div className="text-xs text-gray-500">실패 단어</div><div className="font-bold">{metrics.failedWords}</div></div>
                    <div><div className="text-xs text-gray-500">최대 콤보</div><div className="font-bold">{metrics.maxCombo}</div></div>
                </div>

                <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">최근 입력</h4>
                    <div className="space-y-1">
                        {recentAttempts.map((attempt) => (
                            <div key={`${attempt.target}-${attempt.completedAt}`} className="flex justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-200">{attempt.target}</span>
                                <span className={attempt.isCorrect ? 'text-green-600' : 'text-red-600'}>{attempt.submitted}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onRestart} className="flex-1 bg-blue-600 text-white py-2 rounded">다시 시작</button>
                    <button onClick={onExitToSetup} className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 py-2 rounded">설정으로 돌아가기</button>
                    <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 rounded">닫기</button>
                </div>
            </div>
        </div>
    );
};

export default TypingPracticeResultModal;
```

- [ ] **Step 5: Add body UI**

Create `src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx`:

```tsx
"use client";

import React from 'react';
import GameInput from '../components/GameInput';
import GraphBar from '../components/GraphBar';
import { useTypingPractice } from './hooks/useTypingPractice';
import TypingPracticeResultModal from './TypingPracticeResultModal';
import type { TypingPracticeSettings } from './types/typing-practice.types';

type Props = {
    settings: TypingPracticeSettings;
    onExitToSetup: () => void;
};

const formatNumber = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';

const renderTarget = (target: string, input: string) => {
    return target.split('').map((char, index) => {
        const typed = input[index];
        const className = typed === undefined
            ? 'text-[#EEEEEE]'
            : typed === char
                ? 'text-green-300'
                : 'text-red-300 underline';

        return <span key={`${char}-${index}`} className={className}>{char}</span>;
    });
};

const TypingPracticeBody = ({ settings, onExitToSetup }: Props) => {
    const practice = useTypingPractice(settings);

    if (practice.blockedMessage) {
        return (
            <div className="h-[410px] w-[1000px] bg-white dark:bg-gray-900 p-8 text-center text-gray-800 dark:text-gray-100">
                {practice.blockedMessage}
            </div>
        );
    }

    return (
        <>
            <div className="relative">
                <div className="game-head flex items-start">
                    <div className="items pt-[50px] mt-[50px] mx-[40px] ml-[105px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/lefthand.png')] bg-no-repeat" style={{ textShadow: '0px 1px 5px #141414' }}>
                        {practice.metrics.combo}
                    </div>

                    <div className="jjoriping w-[500px]">
                        <div className="p-[20px_5px_5px_5px] border-2 border-black rounded-bl-[10px] rounded-br-[10px] mt-[40px] w-[486px] h-[120px] bg-[#DEAF56] ml-8">
                            <div className="p-[8px_5px] rounded-[10px] rounded-bl-none rounded-br-none w-[474px] h-[40px] text-[20px] text-center bg-black/70 whitespace-nowrap overflow-hidden text-ellipsis">
                                {practice.targetWord ? renderTarget(practice.targetWord, practice.input) : '단어를 불러오는 중...'}
                            </div>
                            <GraphBar
                                className="border-l border-r border-black/70 w-[474px] h-[20px] bg-[#70712D]"
                                min={0}
                                val={practice.progressValue}
                                max={practice.progressMax}
                                bgc="#E6E846"
                                label={`${Math.floor(practice.progressValue)} / ${practice.progressMax}`}
                            />
                            <div className="border-l border-r border-b border-black/70 rounded-bl-[10px] rounded-br-[10px] w-[474px] h-[20px] bg-[#223C6C] text-white text-xs flex justify-around">
                                <span>WPM {formatNumber(practice.metrics.wpm)}</span>
                                <span>분당타자수 {formatNumber(practice.metrics.charactersPerMinute)}</span>
                                <span>정확도 {formatNumber(practice.metrics.accuracy)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="chain pt-[50px] mt-[50px] mx-[105px] mr-[40px] w-[100px] h-[110px] text-[24px] text-[#EEEEEE] font-bold text-center bg-[url('/img/righthand.png')] bg-no-repeat" style={{ textShadow: '0px 1px 5px #141414' }}>
                        {Math.round(practice.metrics.accuracy)}%
                    </div>
                </div>
            </div>

            <div className="ml-[270px]">
                <GameInput
                    placeholder="표시된 단어를 정확히 입력하세요."
                    value={practice.input}
                    onChange={practice.handleInputChange}
                    onKeyDown={practice.handleKeyDown}
                    onCompositionStart={practice.handleCompositionStart}
                    onCompositionEnd={practice.handleCompositionEnd}
                />
            </div>

            {practice.resultOpen && (
                <TypingPracticeResultModal
                    metrics={practice.metrics}
                    attempts={practice.attempts}
                    onRestart={() => void practice.restart()}
                    onExitToSetup={onExitToSetup}
                    onClose={practice.closeResult}
                />
            )}
        </>
    );
};

export default TypingPracticeBody;
```

- [ ] **Step 6: Run body tests**

Run: `npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/mini-game/game/components/GameInput.tsx src/app/mini-game/game/typing-practice/TypingPracticeBody.tsx src/app/mini-game/game/typing-practice/TypingPracticeResultModal.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx
git commit -m "feat: add typing practice play screen"
```

---

### Task 5: Wire Mode Selection into Game Shell

**Files:**
- Modify: `src/app/mini-game/game/Game.tsx`
- Modify: `src/app/mini-game/game/components/KkutuMenu.tsx`
- Test: `src/__tests__/mini-game/game/Game.test.tsx`

**Interfaces:**
- Consumes: `PRACTICE_TYPE_STORAGE_KEY`, `TYPING_SETTING_STORAGE_KEY`, `TypingPracticeBody`.
- Produces:
  - screen mode remains Redux-level only.
  - `Game` reads persisted practice type and typing settings before rendering play body.
  - `KkutuMenu` blocks typing-practice start with `blockStart('단어를 먼저 업로드해주세요.')` when `hasWords()` is false.

- [ ] **Step 1: Write failing integration test**

Extend `src/__tests__/mini-game/game/Game.test.tsx`:

```tsx
it('renders typing practice body when typing practice is selected and start is requested', async () => {
    localStorage.setItem('kkutu_practice_type', 'typing-practice');
    localStorage.setItem('kkutu_typing_practice_setting', JSON.stringify({
        sessionMode: 'fixed-count',
        durationSeconds: 60,
        wordCount: 10,
        language: 'all',
        order: 'sorted',
        minLength: 2,
    }));

    render(<Game />);

    await userEvent.click(screen.getByRole('button', { name: /시작/ }));

    expect(await screen.findByPlaceholderText('표시된 단어를 정확히 입력하세요.')).toBeInTheDocument();
});

it('blocks typing practice start when no words are uploaded', async () => {
    const { hasWords } = jest.requireMock('@/src/app/mini-game/game/lib/wordDB');
    hasWords.mockResolvedValue(false);
    localStorage.setItem('kkutu_practice_type', 'typing-practice');

    render(<Game />);

    await userEvent.click(screen.getByRole('button', { name: /시작/ }));

    expect(await screen.findByText('단어를 먼저 업로드해주세요.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing integration test**

Run: `npx jest src/__tests__/mini-game/game/Game.test.tsx`

Expected: FAIL because `Game` still always renders `GameBody` after start and `KkutuMenu` does not block empty typing-practice starts.

- [ ] **Step 3: Add mode read helpers in `Game.tsx`**

Modify `src/app/mini-game/game/Game.tsx` to load persisted mode and settings:

```tsx
import { useEffect, useState } from "react";
import TypingPracticeBody from "./typing-practice/TypingPracticeBody";
import type { TypingPracticeSettings } from "./typing-practice/types/typing-practice.types";
import { PRACTICE_TYPE_STORAGE_KEY, TYPING_SETTING_STORAGE_KEY } from "./GameSetup";

type PracticeType = 'word-chain' | 'typing-practice';

const defaultTypingPracticeSetting: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};
```

Inside `Game`:

```tsx
const [practiceType, setPracticeType] = useState<PracticeType>('word-chain');
const [typingPracticeSetting, setTypingPracticeSetting] = useState<TypingPracticeSettings>(defaultTypingPracticeSetting);

useEffect(() => {
    try {
        const rawPracticeType = localStorage.getItem(PRACTICE_TYPE_STORAGE_KEY);
        setPracticeType(rawPracticeType === 'typing-practice' ? 'typing-practice' : 'word-chain');

        const rawTypingSetting = localStorage.getItem(TYPING_SETTING_STORAGE_KEY);
        if (rawTypingSetting) {
            setTypingPracticeSetting({ ...defaultTypingPracticeSetting, ...JSON.parse(rawTypingSetting) });
        }
    } catch (e) {
        console.error(e);
    }
}, [isPlaying]);
```

Render body:

```tsx
{isPlaying ? (
    <GameBox>
        {practiceType === 'typing-practice' ? (
            <TypingPracticeBody settings={typingPracticeSetting} onExitToSetup={() => exitGame()} />
        ) : (
            <GameBody />
        )}
    </GameBox>
) : (
    <GameSetup />
)}
```

Pull `exitGame` from `useGameState()`.

- [ ] **Step 4: Block empty typing-practice starts in `KkutuMenu`**

Modify `src/app/mini-game/game/components/KkutuMenu.tsx` imports:

```tsx
import { hasWords } from '../lib/wordDB';
import { PRACTICE_TYPE_STORAGE_KEY } from '../GameSetup';
```

Include `blockStart` in the `useGameState()` destructuring:

```tsx
const {
    isPlaying,
    requestStart,
    exitGame,
    startBlocked,
    startBlockedMessage,
    dismissStartBlocked,
    blockStart,
} = useGameState();
```

Make `handleButtonClick` async and gate typing-practice start:

```tsx
const handleButtonClick = async (buttonId: string) => {
    if (buttonId === 'start') {
        try {
            const practiceType = localStorage.getItem(PRACTICE_TYPE_STORAGE_KEY);
            if (practiceType === 'typing-practice' && !(await hasWords())) {
                blockStart('단어를 먼저 업로드해주세요.');
                return;
            }
        } catch (e) {
            console.error(e);
        }

        requestStart();
        return;
    }

    if (buttonId === 'exit') {
        exitGame();
        return;
    }

    if (buttonId === 'help') {
        setHelpOpen(true);
        return;
    }

    if (buttonId === 'settings') {
        setSettingsOpen(true);
        return;
    }

    if (buttonId === 'dict') {
        setDictOpen(true);
    }
};
```

Update start button click to ignore the returned promise:

```tsx
onClick={() => void handleButtonClick('start')}
```

Use the same `void handleButtonClick(...)` pattern for other menu buttons.

Do not call `GameManager.canGameStart()` from typing-practice mode.

- [ ] **Step 5: Run integration test**

Run: `npx jest src/__tests__/mini-game/game/Game.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/mini-game/game/Game.tsx src/app/mini-game/game/components/KkutuMenu.tsx src/__tests__/mini-game/game/Game.test.tsx
git commit -m "feat: wire typing practice into mini game"
```

---

### Task 6: Help Text, Regression, and Final Verification

**Files:**
- Modify: `src/app/mini-game/game/components/HelpModal.tsx`
- Test: existing mini-game tests

**Interfaces:**
- Consumes: all prior tasks.
- Produces: final reviewed feature with help text and passing regression tests.

- [ ] **Step 1: Add help modal test**

Extend `src/__tests__/mini-game/game/components/HelpModal.test.tsx`:

```tsx
it('documents typing practice mode', () => {
    render(<HelpModal onClose={jest.fn()} />);

    expect(screen.getByText('타자 연습 관련')).toBeInTheDocument();
    expect(screen.getByText(/WPM/)).toBeInTheDocument();
    expect(screen.getByText(/분당타자수/)).toBeInTheDocument();
    expect(screen.getByText(/콤보/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing help test**

Run: `npx jest src/__tests__/mini-game/game/components/HelpModal.test.tsx`

Expected: FAIL because help modal has no typing-practice section.

- [ ] **Step 3: Update help modal**

Modify `src/app/mini-game/game/components/HelpModal.tsx` by adding a new section before `기타 도움말`:

```tsx
<div className="bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-cyan-200 dark:border-cyan-700 shadow-sm">
    <h4 className="font-bold text-cyan-800 dark:text-cyan-200 mb-2 flex items-center gap-2 text-base">
        타자 연습 관련
    </h4>
    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200 ml-2">
        <li>타자 연습은 업로드한 단어를 보고 정확히 입력하는 모드입니다.</li>
        <li>WPM, 분당타자수, 정확도, 콤보를 실시간으로 확인할 수 있습니다.</li>
        <li>오타가 있는 상태로 제출하면 해당 단어는 실패로 기록되고 콤보가 초기화됩니다.</li>
        <li>시간 제한 또는 단어 수 제한을 선택해 연습할 수 있습니다.</li>
    </ul>
</div>
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx jest src/__tests__/mini-game/game/typing-practice/TypingPracticeLogic.test.ts src/__tests__/mini-game/game/typing-practice/TypingPracticeSettings.test.tsx src/__tests__/mini-game/game/typing-practice/useTypingPractice.test.tsx src/__tests__/mini-game/game/typing-practice/TypingPracticeBody.test.tsx src/__tests__/mini-game/game/Game.test.tsx src/__tests__/mini-game/game/GameSetup.test.tsx src/__tests__/mini-game/game/components/HelpModal.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected:

- `npm test`: PASS.
- `git diff --check`: no whitespace errors.
- `git status --short`: only intended modified or untracked files before the final commit.

- [ ] **Step 6: Commit**

```bash
git add src/app/mini-game/game/components/HelpModal.tsx src/__tests__/mini-game/game/components/HelpModal.test.tsx
git commit -m "docs: add typing practice help"
```

---

## Self-Review Notes

- Spec coverage: tasks cover mode selection, shared word DB, isolated typing-practice logic, setup persistence, live metrics, IME handlers, result modal, error states, help text, and regression tests.
- Scope check: this remains one feature inside `/mini-game`; no Supabase, ranking, account history, or prompt-response training is included.
- Type consistency: `TypingPracticeSettings`, `TypingPracticeAttempt`, and `TypingPracticeMetrics` are defined in Task 1 and reused by all later tasks.
- Execution risk: Task 5 may need small adjustments to existing tests if they assume `Game` always renders `GameBody` while `isPlaying` is true. Keep those changes local to mode-aware assertions.
