import { err, ok, type Result } from '@/src/shared/application/result';
import type {
    RequestWordAdditionCommand,
    RequestWordAdditionsCommand,
    UserWordRequestCommand,
} from '../application/user-word-request-types';

export const MAX_USER_WORD_ADDITION_THEMES = 100;

const validationError = (field: string, message: string) => err({
    kind: 'validation' as const,
    field,
    message,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function normalizeUserWordRequestCommand(
    command: UserWordRequestCommand,
): Result<UserWordRequestCommand> {
    const rawWord: unknown = (command as { word?: unknown } | null)?.word;
    if (typeof rawWord !== 'string' || rawWord.trim().length === 0) {
        return err({ kind: 'validation', field: 'word', message: '단어를 입력해 주세요.' });
    }
    return ok({ word: rawWord.trim() });
}

/** 사용자 단어 추가 요청을 RPC 전송 전에 정규화하고 검증합니다. */
export function normalizeRequestWordAdditionCommand(
    command: unknown,
): Result<RequestWordAdditionCommand> {
    if (!isRecord(command)) {
        return validationError('word', '단어를 입력해 주세요.');
    }

    const normalizedWord = normalizeUserWordRequestCommand(command as UserWordRequestCommand);
    if (!normalizedWord.ok) {
        return normalizedWord;
    }

    if (!Array.isArray(command.themeCodes)
        || command.themeCodes.length > MAX_USER_WORD_ADDITION_THEMES) {
        return validationError('themeCodes', '주제는 100개 이하로 선택해 주세요.');
    }

    const themeCodes: string[] = [];
    const seenThemeCodes = new Set<string>();
    for (const rawThemeCode of command.themeCodes) {
        if (typeof rawThemeCode !== 'string' || rawThemeCode.trim().length === 0) {
            return validationError('themeCodes', '선택한 주제 정보가 올바르지 않습니다.');
        }

        const themeCode = rawThemeCode.trim();
        if (seenThemeCodes.has(themeCode)) {
            return validationError('themeCodes', '같은 주제는 한 번만 선택할 수 있습니다.');
        }
        seenThemeCodes.add(themeCode);
        themeCodes.push(themeCode);
    }

    return ok({
        word: normalizedWord.value.word,
        themeCodes: themeCodes.sort(),
    });
}

/** 대량 단어 추가 요청을 단어별로 병합하고 안정적인 순서로 정규화합니다. */
export function normalizeRequestWordAdditionsCommand(
    command: unknown,
): Result<RequestWordAdditionsCommand> {
    if (!isRecord(command) || !Array.isArray(command.entries) || command.entries.length === 0) {
        return validationError('entries', '요청할 단어를 하나 이상 입력해 주세요.');
    }

    const themesByWord = new Map<string, Set<string>>();
    for (const entry of command.entries) {
        const normalizedEntry = normalizeRequestWordAdditionCommand(entry);
        if (!normalizedEntry.ok) {
            return normalizedEntry;
        }

        const { word, themeCodes } = normalizedEntry.value;
        const mergedThemes = themesByWord.get(word) ?? new Set<string>();
        themeCodes.forEach((themeCode) => mergedThemes.add(themeCode));
        if (mergedThemes.size > MAX_USER_WORD_ADDITION_THEMES) {
            return validationError('themeCodes', '주제는 단어마다 100개 이하로 선택해 주세요.');
        }
        themesByWord.set(word, mergedThemes);
    }

    return ok({
        entries: [...themesByWord.entries()]
            .sort(([leftWord], [rightWord]) => leftWord.localeCompare(rightWord, 'ko'))
            .map(([word, themeCodes]) => ({
                word,
                themeCodes: [...themeCodes].sort(),
            })),
    });
}
