import {
    MAX_WORD_DELETION_BATCH_SIZE,
    normalizeWordDeletionEntries,
    splitWordDeletionBatches,
} from '@/src/modules/word-moderation/domain/word-deletion';

describe('word deletion domain', () => {
    it('removes CR and empty lines, deduplicates, and sorts deterministically', () => {
        const result = normalizeWordDeletionEntries([
            { word: '하늘\r' },
            { word: '' },
            { word: '가방' },
            { word: '하늘' },
        ]);
        expect(result).toEqual({
            ok: true,
            value: [{ word: '가방' }, { word: '하늘' }],
        });
    });

    it('rejects leading or trailing whitespace instead of silently changing a word', () => {
        const result = normalizeWordDeletionEntries([{ word: ' 가방' }]);
        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'word' }),
        });
    });

    it('rejects input with no words', () => {
        expect(normalizeWordDeletionEntries([{ word: '' }])).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'entries' }),
        });
    });

    it('splits batches and enforces the DB maximum', () => {
        const entries = Array.from({ length: 51 }, (_, index) => ({ word: `단어${index}` }));
        expect(splitWordDeletionBatches(entries, 50)).toEqual({
            ok: true,
            value: [entries.slice(0, 50), entries.slice(50)],
        });
        expect(splitWordDeletionBatches(entries, MAX_WORD_DELETION_BATCH_SIZE + 1)).toEqual({
            ok: false,
            error: expect.objectContaining({ kind: 'validation', field: 'batchSize' }),
        });
    });
});
