import {
    normalizeRequestWordAdditionCommand,
    normalizeRequestWordAdditionsCommand,
    normalizeUserWordRequestCommand,
} from '@/src/modules/word-requests/domain/user-word-request';

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

    it('normalizes an addition request and sorts theme codes', () => {
        expect(normalizeRequestWordAdditionCommand({
            word: '  나비  ',
            themeCodes: [' place ', 'animal'],
        })).toEqual({
            ok: true,
            value: { word: '나비', themeCodes: ['animal', 'place'] },
        });
    });

    it('allows an addition request without themes', () => {
        expect(normalizeRequestWordAdditionCommand({
            word: '무주제단어',
            themeCodes: [],
        })).toEqual({
            ok: true,
            value: { word: '무주제단어', themeCodes: [] },
        });
    });

    it.each([
        ['a non-array theme list', { word: '나비', themeCodes: null }],
        ['a blank theme code', { word: '나비', themeCodes: [' '] }],
        ['duplicate normalized theme codes', { word: '나비', themeCodes: ['animal', ' animal '] }],
        ['more than 100 themes', {
            word: '나비',
            themeCodes: Array.from({ length: 101 }, (_, index) => `theme-${index}`),
        }],
    ])('rejects %s', (_description, command) => {
        expect(normalizeRequestWordAdditionCommand(command)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'themeCodes' },
        });
    });

    it('normalizes a batch and merges themes for duplicate normalized words', () => {
        expect(normalizeRequestWordAdditionsCommand({
            entries: [
                { word: ' 나비 ', themeCodes: ['place'] },
                { word: '가방', themeCodes: [] },
                { word: '나비', themeCodes: [' animal ', 'place'] },
            ],
        })).toEqual({
            ok: true,
            value: {
                entries: [
                    { word: '가방', themeCodes: [] },
                    { word: '나비', themeCodes: ['animal', 'place'] },
                ],
            },
        });
    });

    it.each([
        ['a non-array entry list', { entries: null }],
        ['an empty entry list', { entries: [] }],
        ['an invalid entry', { entries: [{ word: '나비', themeCodes: [' '] }] }],
    ])('rejects a batch with %s', (_description, command) => {
        expect(normalizeRequestWordAdditionsCommand(command)).toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
    });
});
