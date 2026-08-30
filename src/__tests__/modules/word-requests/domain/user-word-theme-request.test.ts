import { normalizeUserWordThemeChangesCommand } from '@/src/modules/word-requests/domain/user-word-theme-request';

describe('user word theme request domain', () => {
    it('normalizes without mutating caller input and sorts by theme code then type', () => {
        const command = {
            word: '  나비  ',
            changes: [
                { themeCode: '  Z  ', type: 'delete' as const },
                { themeCode: 'M', type: 'delete' as const },
                { themeCode: ' A ', type: 'add' as const },
            ],
        };

        expect(normalizeUserWordThemeChangesCommand(command)).toEqual({
            ok: true,
            value: {
                word: '나비',
                changes: [
                    { themeCode: 'A', type: 'add' },
                    { themeCode: 'M', type: 'delete' },
                    { themeCode: 'Z', type: 'delete' },
                ],
            },
        });
        expect(command).toEqual({
            word: '  나비  ',
            changes: [
                { themeCode: '  Z  ', type: 'delete' },
                { themeCode: 'M', type: 'delete' },
                { themeCode: ' A ', type: 'add' },
            ],
        });
    });

    it.each([
        ['no changes', []],
        ['more than 100 changes', Array.from({ length: 101 }, (_, index) => ({ themeCode: `T${index}`, type: 'add' }))],
        ['a malformed changes value', null],
    ])('rejects %s', (_description, changes) => {
        expect(normalizeUserWordThemeChangesCommand({ word: '나비', changes } as never)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'changes' },
        });
    });

    it.each([
        ['a blank word', { word: ' ', changes: [{ themeCode: 'A', type: 'add' }] }],
        ['a non-string word', { word: 7, changes: [{ themeCode: 'A', type: 'add' }] }],
        ['a blank theme code', { word: '나비', changes: [{ themeCode: ' ', type: 'add' }] }],
        ['a non-string theme code', { word: '나비', changes: [{ themeCode: 7, type: 'add' }] }],
        ['an invalid change type', { word: '나비', changes: [{ themeCode: 'A', type: 'replace' }] }],
        ['a non-object change', { word: '나비', changes: [null] }],
        ['a duplicate normalized theme code', { word: '나비', changes: [{ themeCode: ' A ', type: 'add' }, { themeCode: 'A', type: 'delete' }] }],
    ])('rejects %s at the runtime boundary', (_description, command) => {
        expect(normalizeUserWordThemeChangesCommand(command as never)).toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
    });
});
