import { Buffer } from 'node:buffer';
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

    it('accepts exact word character and UTF-8 byte boundaries', () => {
        const koreanBoundaryWord = '가'.repeat(100);

        expect(Buffer.byteLength(koreanBoundaryWord, 'utf8')).toBe(300);
        expect(normalizeDirectWordAdditionCommand({
            word: koreanBoundaryWord,
            themeCodes: [],
        }, () => false)).toMatchObject({ ok: true });
    });

    it.each([
        ['word character limit', '1'.repeat(101)],
        ['word UTF-8 byte limit', '😀'.repeat(76)],
    ])('rejects input over the %s', (_description, word) => {
        expect(normalizeDirectWordAdditionCommand({
            word,
            themeCodes: [],
        }, () => false)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
    });

    it('accepts exact theme-code character and UTF-8 byte boundaries', () => {
        const koreanBoundaryCode = '가'.repeat(64);

        expect(Buffer.byteLength(koreanBoundaryCode, 'utf8')).toBe(192);
        expect(normalizeDirectWordAdditionCommand({
            word: '사과',
            themeCodes: [koreanBoundaryCode],
        }, () => false)).toMatchObject({ ok: true });
    });

    it.each([
        ['theme-code character limit', 'x'.repeat(65)],
        ['theme-code UTF-8 byte limit', '😀'.repeat(49)],
    ])('rejects input over the %s', (_description, themeCode) => {
        expect(normalizeDirectWordAdditionCommand({
            word: '사과',
            themeCodes: [themeCode],
        }, () => false)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'themeCodes' },
        });
    });
});
