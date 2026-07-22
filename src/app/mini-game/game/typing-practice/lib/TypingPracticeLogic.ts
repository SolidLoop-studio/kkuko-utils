import { disassemble } from 'es-hangul';
import type {
    TypingPracticeAttempt,
    TypingPracticeJudgmentMode,
    TypingPracticeMetrics,
    TypingPracticeSettings,
} from '../types/typing-practice.types';

const KOREAN_START = /^[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const ENGLISH_START = /^[a-zA-Z]/;
const WORD_PATTERN = /[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g;

export class TypingPracticeLogic {
    public static normalizeWord(word: string): string {
        return word.replace(WORD_PATTERN, '').toLowerCase();
    }

    public static countTypingUnits(word: string): number {
        const normalizedWord = this.normalizeWord(word);
        return KOREAN_START.test(normalizedWord)
            ? disassemble(normalizedWord).length
            : Array.from(normalizedWord).length;
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

    public static scoreAttempt(
        target: string,
        submitted: string,
        completedAt = Date.now(),
        _judgmentMode: TypingPracticeJudgmentMode = 'loose',
    ): TypingPracticeAttempt {
        const normalizedTarget = this.normalizeWord(target);
        const normalizedSubmitted = this.normalizeWord(submitted);
        const targetCharacters = Array.from(normalizedTarget);
        const submittedCharacters = Array.from(normalizedSubmitted);
        const correctCharacters = submittedCharacters.reduce((count, char, index) => {
            return count + (targetCharacters[index] === char ? 1 : 0);
        }, 0);
        const isCorrect = normalizedTarget === normalizedSubmitted;
        const typingUnits = isCorrect
            ? this.countTypingUnits(normalizedTarget)
            : 0;

        return {
            target: normalizedTarget,
            submitted: normalizedSubmitted,
            isCorrect,
            correctCharacters,
            submittedCharacters: submittedCharacters.length,
            typingUnits,
            completedAt,
        };
    }

    public static evaluateStrictInput(target: string, submitted: string): { accepted: boolean } {
        const normalizedTarget = this.normalizeWord(target);
        const normalizedSubmitted = this.normalizeWord(submitted);
        return {
            accepted: submitted === normalizedSubmitted
                && disassemble(normalizedTarget).startsWith(disassemble(normalizedSubmitted)),
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
        mistakeCount = 0,
        judgmentMode: TypingPracticeJudgmentMode = 'loose',
    ): TypingPracticeMetrics {
        const rawElapsedMs = Math.max(elapsedMs, 0);
        const rateElapsedMinutes = Math.max(rawElapsedMs, 1000) / 60000;
        const correctCharacters = attempts.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
        const totalSubmittedCharacters = attempts.reduce((sum, attempt) => sum + attempt.submittedCharacters, 0);
        const typingUnits = attempts.reduce((sum, attempt) => sum + attempt.typingUnits, 0);
        const completedWords = attempts.filter((attempt) => attempt.isCorrect).length;
        const failedWords = attempts.length - completedWords;
        const looseAccuracy = (correctCharacters / Math.max(totalSubmittedCharacters, 1)) * 100;
        const strictAccuracy = (typingUnits / Math.max(typingUnits + mistakeCount, 1)) * 100;

        return {
            correctCharacters,
            totalSubmittedCharacters,
            typingUnits,
            mistakeCount,
            accuracy: judgmentMode === 'strict' ? strictAccuracy : looseAccuracy,
            wpm: typingUnits / 5 / rateElapsedMinutes,
            charactersPerMinute: typingUnits / rateElapsedMinutes,
            completedWords,
            failedWords,
            totalAttempts: attempts.length,
            averageWordTime: attempts.length > 0 ? rawElapsedMs / attempts.length : 0,
            combo,
            maxCombo,
            elapsedMs: rawElapsedMs,
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
