import {
    DEFAULT_PRACTICE_CONFIG,
    DEFAULT_TYPING_PRACTICE_SETTINGS,
    PRACTICE_TYPE_STORAGE_KEY,
    TYPING_SETTING_STORAGE_KEY,
    loadPracticeConfig,
    writePracticeType,
    writeTypingPracticeSetting,
} from '@/src/app/mini-game/game/typing-practice/lib/typing-practice-config';

describe('typing practice persisted config', () => {
    it('parses a valid persisted mode and settings', () => {
        const storage = {
            getItem: jest.fn((key: string) => {
                if (key === PRACTICE_TYPE_STORAGE_KEY) return 'typing-practice';
                if (key === TYPING_SETTING_STORAGE_KEY) {
                    return JSON.stringify({
                        sessionMode: 'fixed-count',
                        durationSeconds: 120,
                        wordCount: 50,
                        language: 'ko',
                        order: 'sorted',
                        judgmentMode: 'strict',
                        minLength: 7,
                    });
                }
                return null;
            }),
        };

        expect(loadPracticeConfig(storage)).toEqual({
            practiceType: 'typing-practice',
            typingSettings: {
                sessionMode: 'fixed-count',
                durationSeconds: 120,
                wordCount: 50,
                language: 'ko',
                order: 'sorted',
                minLength: 7,
            },
        });
    });

    it('falls back field-by-field for malformed or unvalidated persisted values', () => {
        const storage = {
            getItem: jest.fn((key: string) => key === PRACTICE_TYPE_STORAGE_KEY
                ? 'unknown-mode'
                : JSON.stringify({
                    sessionMode: 'endless',
                    durationSeconds: 120,
                    wordCount: 2,
                    language: 'ko',
                    order: 'sorted',
                    judgmentMode: 'invalid',
                    minLength: 99,
                })),
        };

        expect(loadPracticeConfig(storage)).toEqual({
            ...DEFAULT_PRACTICE_CONFIG,
            typingSettings: {
                ...DEFAULT_TYPING_PRACTICE_SETTINGS,
                durationSeconds: 120,
                language: 'ko',
                order: 'sorted',
            },
        });
    });

    it('returns defaults when storage access or JSON parsing fails', () => {
        expect(loadPracticeConfig({ getItem: () => { throw new Error('denied'); } })).toEqual(DEFAULT_PRACTICE_CONFIG);
        expect(loadPracticeConfig({ getItem: () => '{invalid' })).toEqual(DEFAULT_PRACTICE_CONFIG);
    });

    it('writes canonical mode and settings through the shared storage boundary', () => {
        const stored = new Map<string, string>();
        const storage = {
            getItem: (key: string) => stored.get(key) ?? null,
            setItem: (key: string, value: string) => stored.set(key, value),
        };
        const settings = {
            ...DEFAULT_TYPING_PRACTICE_SETTINGS,
            sessionMode: 'fixed-count' as const,
            wordCount: 50 as const,
            minLength: 4,
        };

        writePracticeType('typing-practice', storage);
        writeTypingPracticeSetting(settings, storage);

        expect(loadPracticeConfig(storage)).toEqual({
            practiceType: 'typing-practice',
            typingSettings: settings,
        });
    });
});
