import { normalizeDirectWordAdditionCommand } from '@/src/modules/word-moderation/domain/direct-word-addition';

describe('normalizeDirectWordAdditionCommand', () => {
    it('trims the word and theme codes, sorts themes, and derives noin through the pure policy', () => {
        const isNoin = jest.fn().mockReturnValue(true);

        const result = normalizeDirectWordAdditionCommand({
            word: '  사과  ',
            themeCodes: [' place ', 'animal'],
        }, isNoin);

        expect(result).toEqual({
            ok: true,
            value: {
                word: '사과',
                themeCodes: ['animal', 'place'],
                noinCanUse: true,
            },
        });
        expect(isNoin).toHaveBeenCalledWith(['animal', 'place']);
    });

    it.each([
        ['a non-object command', null, 'word'],
        ['a blank word', { word: ' ', themeCodes: [] }, 'word'],
        ['missing theme codes', { word: '사과' }, 'themeCodes'],
        ['a blank theme code', { word: '사과', themeCodes: [' '] }, 'themeCodes'],
        ['duplicate normalized theme codes', { word: '사과', themeCodes: ['a', ' a '] }, 'themeCodes'],
        ['too many themes', {
            word: '사과',
            themeCodes: Array.from({ length: 101 }, (_, index) => `theme-${index}`),
        }, 'themeCodes'],
    ])('rejects %s', (_description, command, field) => {
        expect(normalizeDirectWordAdditionCommand(command, () => false)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });
});
