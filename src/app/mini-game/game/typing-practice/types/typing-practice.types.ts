export type TypingPracticeSessionMode = 'timed' | 'fixed-count';
export type TypingPracticeLanguage = 'ko' | 'en' | 'all';
export type TypingPracticeOrder = 'random' | 'sorted';
export type TypingPracticeJudgmentMode = 'loose' | 'strict';

export type TypingPracticeSettings = {
    sessionMode: TypingPracticeSessionMode;
    durationSeconds: 30 | 60 | 120;
    wordCount: 10 | 25 | 50;
    language: TypingPracticeLanguage;
    order: TypingPracticeOrder;
    judgmentMode?: TypingPracticeJudgmentMode;
    minLength: number;
};

export type TypingPracticeAttempt = {
    target: string;
    submitted: string;
    isCorrect: boolean;
    correctCharacters: number;
    submittedCharacters: number;
    typingUnits: number;
    completedAt: number;
};

export type TypingPracticeMetrics = {
    correctCharacters: number;
    totalSubmittedCharacters: number;
    typingUnits: number;
    mistakeCount: number;
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
