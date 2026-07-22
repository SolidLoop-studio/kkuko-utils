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

    it('filters English words in fixed-count mode', () => {
        const queue = TypingPracticeLogic.prepareQueue(
            [{ word: 'banana' }, { word: 'apple' }, { word: '가방' }],
            { ...baseSettings, language: 'en', order: 'sorted', wordCount: 10 },
        );

        expect(queue).toEqual(['apple', 'banana']);
    });

    it('random order keeps the same words without duplicates when random is deterministic', () => {
        const queue = TypingPracticeLogic.prepareQueue(
            [{ word: '가방' }, { word: '나무' }, { word: '다리' }],
            { ...baseSettings, order: 'random', wordCount: 10 },
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

    it('normalizes submitted attempts before scoring character metrics', () => {
        expect(TypingPracticeLogic.scoreAttempt('단순누진율', '단수누')).toMatchObject({
            isCorrect: false,
            correctCharacters: 2,
            submittedCharacters: 3,
        });

        expect(TypingPracticeLogic.scoreAttempt('가방', '가 방')).toMatchObject({
            isCorrect: true,
            correctCharacters: 2,
            submittedCharacters: 2,
        });
    });

    it('keeps raw elapsed time while clamping only rate denominators', () => {
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
        expect(metrics.averageWordTime).toBe(0);
        expect(metrics.elapsedMs).toBe(0);
    });

    it('normalizes negative elapsed time without inflating session duration', () => {
        const attempts = [TypingPracticeLogic.scoreAttempt('apple', 'apple')];

        const metrics = TypingPracticeLogic.calculateMetrics(attempts, -500, 1, 1);

        expect(metrics.elapsedMs).toBe(0);
        expect(metrics.averageWordTime).toBe(0);
        expect(metrics.wpm).toBeCloseTo(60, 4);
        expect(metrics.charactersPerMinute).toBeCloseTo(300, 4);
    });

    it('updates combo and max combo from attempt correctness', () => {
        const correct = TypingPracticeLogic.scoreAttempt('가방', '가방');
        const fail = TypingPracticeLogic.scoreAttempt('나무', '나비');

        expect(TypingPracticeLogic.nextCombo(correct, 2, 2)).toEqual({ combo: 3, maxCombo: 3 });
        expect(TypingPracticeLogic.nextCombo(fail, 3, 3)).toEqual({ combo: 0, maxCombo: 3 });
    });
});
