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
