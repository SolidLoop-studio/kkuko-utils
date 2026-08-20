import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';

export const MAX_WORD_APPROVAL_BATCH_SIZE = 50;

export type RawWordApprovalEntry = {
    word: string;
    themeCodes: string[];
};

export type NormalizedWordApprovalEntry = {
    word: string;
    themeCodes: string[];
    noinCanUse: boolean;
};

const NO_INJUNG_THEME_CODES = new Set(
    Array.from({ length: 54 }, (_, index) => String(index * 10)),
);

const validationError = (field: string, message: string) => ({
    kind: 'validation' as const,
    field,
    message,
});

export function isNoInjungTheme(themeCodes: readonly string[]): boolean {
    return themeCodes.some((themeCode) => NO_INJUNG_THEME_CODES.has(themeCode));
}

export function normalizeWordApprovalEntries(
    entries: RawWordApprovalEntry[],
): Result<NormalizedWordApprovalEntry[]> {
    if (entries.length === 0) {
        return err(validationError('entries', '승인할 단어가 없습니다.'));
    }

    const normalizedEntries = new Map<string, Set<string>>();

    for (const entry of entries) {
        const word = entry.word.trim();
        if (word.length === 0) {
            return err(validationError('word', '단어는 비어 있을 수 없습니다.'));
        }

        const themeCodes = entry.themeCodes.map((themeCode) => themeCode.trim());
        if (themeCodes.length === 0 || themeCodes.some((themeCode) => themeCode.length === 0)) {
            return err(validationError('themeCodes', '주제 코드는 비어 있을 수 없습니다.'));
        }

        const mergedThemeCodes = normalizedEntries.get(word) ?? new Set<string>();
        themeCodes.forEach((themeCode) => mergedThemeCodes.add(themeCode));
        normalizedEntries.set(word, mergedThemeCodes);
    }

    const value = Array.from(normalizedEntries, ([word, themeCodes]) => {
        const sortedThemeCodes = Array.from(themeCodes).sort();
        return {
            word,
            themeCodes: sortedThemeCodes,
            noinCanUse: isNoInjungTheme(sortedThemeCodes),
        };
    }).sort((left, right) => left.word.localeCompare(right.word, 'ko'));

    return ok(value);
}

export function splitWordApprovalBatches(
    entries: NormalizedWordApprovalEntry[],
    batchSize: number,
): Result<NormalizedWordApprovalEntry[][]> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_WORD_APPROVAL_BATCH_SIZE) {
        return err(validationError('batchSize', '배치 크기는 1 이상 50 이하여야 합니다.'));
    }

    const batches: NormalizedWordApprovalEntry[][] = [];
    for (let index = 0; index < entries.length; index += batchSize) {
        batches.push(entries.slice(index, index + batchSize));
    }

    return ok(batches);
}
