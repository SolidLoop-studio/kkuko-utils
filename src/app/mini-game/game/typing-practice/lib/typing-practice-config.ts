import type { TypingPracticeSettings } from '../types/typing-practice.types';

export const PRACTICE_TYPE_STORAGE_KEY = 'kkutu_practice_type';
export const TYPING_SETTING_STORAGE_KEY = 'kkutu_typing_practice_setting';

export type PracticeType = 'word-chain' | 'typing-practice';

export const DEFAULT_TYPING_PRACTICE_SETTINGS: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};

export const DEFAULT_PRACTICE_CONFIG = {
    practiceType: 'word-chain' as PracticeType,
    typingSettings: DEFAULT_TYPING_PRACTICE_SETTINGS,
};

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

const getBrowserStorage = (): Storage | undefined => {
    return typeof window === 'undefined' ? undefined : window.localStorage;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseTypingPracticeSetting = (value: unknown): TypingPracticeSettings => {
    if (!isRecord(value)) return { ...DEFAULT_TYPING_PRACTICE_SETTINGS };

    return {
        sessionMode: value.sessionMode === 'fixed-count' || value.sessionMode === 'timed'
            ? value.sessionMode
            : DEFAULT_TYPING_PRACTICE_SETTINGS.sessionMode,
        durationSeconds: value.durationSeconds === 30 || value.durationSeconds === 60 || value.durationSeconds === 120
            ? value.durationSeconds
            : DEFAULT_TYPING_PRACTICE_SETTINGS.durationSeconds,
        wordCount: value.wordCount === 10 || value.wordCount === 25 || value.wordCount === 50
            ? value.wordCount
            : DEFAULT_TYPING_PRACTICE_SETTINGS.wordCount,
        language: value.language === 'ko' || value.language === 'en' || value.language === 'all'
            ? value.language
            : DEFAULT_TYPING_PRACTICE_SETTINGS.language,
        order: value.order === 'sorted' || value.order === 'random'
            ? value.order
            : DEFAULT_TYPING_PRACTICE_SETTINGS.order,
        minLength: typeof value.minLength === 'number'
            && Number.isInteger(value.minLength)
            && value.minLength >= 2
            && value.minLength <= 10
            ? value.minLength
            : DEFAULT_TYPING_PRACTICE_SETTINGS.minLength,
    };
};

export const readPracticeType = (storage: StorageReader | undefined = getBrowserStorage()): PracticeType => {
    if (!storage) return DEFAULT_PRACTICE_CONFIG.practiceType;

    try {
        return storage.getItem(PRACTICE_TYPE_STORAGE_KEY) === 'typing-practice'
            ? 'typing-practice'
            : 'word-chain';
    } catch {
        return DEFAULT_PRACTICE_CONFIG.practiceType;
    }
};

export const readTypingPracticeSetting = (
    storage: StorageReader | undefined = getBrowserStorage(),
): TypingPracticeSettings => {
    if (!storage) return { ...DEFAULT_TYPING_PRACTICE_SETTINGS };

    try {
        const raw = storage.getItem(TYPING_SETTING_STORAGE_KEY);
        return raw ? parseTypingPracticeSetting(JSON.parse(raw)) : { ...DEFAULT_TYPING_PRACTICE_SETTINGS };
    } catch {
        return { ...DEFAULT_TYPING_PRACTICE_SETTINGS };
    }
};

export const loadPracticeConfig = (storage: StorageReader | undefined = getBrowserStorage()) => ({
    practiceType: readPracticeType(storage),
    typingSettings: readTypingPracticeSetting(storage),
});

export const writePracticeType = (
    practiceType: PracticeType,
    storage: StorageWriter | undefined = getBrowserStorage(),
) => {
    try {
        storage?.setItem(PRACTICE_TYPE_STORAGE_KEY, practiceType);
    } catch (error) {
        console.error(error);
    }
};

export const writeTypingPracticeSetting = (
    settings: TypingPracticeSettings,
    storage: StorageWriter | undefined = getBrowserStorage(),
) => {
    try {
        storage?.setItem(TYPING_SETTING_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error(error);
    }
};
