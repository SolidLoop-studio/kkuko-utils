import { normalizeUserWordRequestCommand } from '@/src/modules/word-requests/domain/user-word-request';

describe('user word request domain', () => {
    it('trims surrounding whitespace from a word', () => {
        expect(normalizeUserWordRequestCommand({ word: '  나비  ' })).toEqual({
            ok: true,
            value: { word: '나비' },
        });
    });

    it.each(['', '   '])('rejects an empty normalized word', (word) => {
        expect(normalizeUserWordRequestCommand({ word })).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
    });

    it('rejects a non-string word at the runtime boundary', () => {
        expect(normalizeUserWordRequestCommand({ word: 7 } as never)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
    });
});
