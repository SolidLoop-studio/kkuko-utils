import type { Result } from '@/src/shared/application/result';
import { err, ok } from '@/src/shared/application/result';

export const MAX_WORD_DELETION_BATCH_SIZE = 50;

export type RawWordDeletionEntry = {
    word: string;
};

export type NormalizedWordDeletionEntry = {
    word: string;
};

const validationError = (field: string, message: string) => ({
    kind: 'validation' as const,
    field,
    message,
});

/** ICU locale data와 무관하게 Unicode scalar value 순서로 문자열을 비교합니다. */
const compareUnicodeScalars = (left: string, right: string): number => {
    const leftScalars = Array.from(left, (character) => character.codePointAt(0) ?? 0);
    const rightScalars = Array.from(right, (character) => character.codePointAt(0) ?? 0);
    const sharedLength = Math.min(leftScalars.length, rightScalars.length);

    for (let index = 0; index < sharedLength; index += 1) {
        if (leftScalars[index] !== rightScalars[index]) {
            return leftScalars[index] - rightScalars[index];
        }
    }

    return leftScalars.length - rightScalars.length;
};

export function normalizeWordDeletionEntries(
    entries: RawWordDeletionEntry[],
): Result<NormalizedWordDeletionEntry[]> {
    const normalizedWords = new Set<string>();

    for (const entry of entries) {
        const word = entry.word.endsWith('\r') ? entry.word.slice(0, -1) : entry.word;
        if (word.length === 0) {
            continue;
        }

        if (word.trim() !== word) {
            return err(validationError('word', '단어 앞뒤에 공백을 포함할 수 없습니다.'));
        }

        normalizedWords.add(word);
    }

    if (normalizedWords.size === 0) {
        return err(validationError('entries', '삭제할 단어가 없습니다.'));
    }

    return ok(Array.from(normalizedWords, (word) => ({ word }))
        .sort((left, right) => compareUnicodeScalars(left.word, right.word)));
}

export function splitWordDeletionBatches(
    entries: NormalizedWordDeletionEntry[],
    batchSize: number,
): Result<NormalizedWordDeletionEntry[][]> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_WORD_DELETION_BATCH_SIZE) {
        return err(validationError('batchSize', '배치 크기는 1 이상 50 이하여야 합니다.'));
    }

    const batches: NormalizedWordDeletionEntry[][] = [];
    for (let index = 0; index < entries.length; index += batchSize) {
        batches.push(entries.slice(index, index + batchSize));
    }

    return ok(batches);
}
