import { ok } from '@/src/shared/application/result';
import {
    normalizeWordRequestModerationCommand,
    type ModerateWordRequestsCommand,
} from '@/src/modules/word-moderation/domain/word-request-moderation';

describe('word request moderation domain', () => {
    it('deduplicates and deterministically sorts selection payloads', () => {
        const command: ModerateWordRequestsCommand = {
            selections: [
                {
                    kind: 'theme-change',
                    wordId: 9,
                    changes: [
                        { themeId: 4, type: 'delete' },
                        { themeId: 2, type: 'add' },
                    ],
                },
                {
                    kind: 'word-request',
                    requestId: 3,
                    selectedThemeIds: [8, 2, 8],
                },
            ],
        };

        expect(normalizeWordRequestModerationCommand(command)).toEqual(ok({
            selections: [
                { kind: 'word-request', requestId: 3, selectedThemeIds: [2, 8] },
                {
                    kind: 'theme-change',
                    wordId: 9,
                    changes: [
                        { themeId: 2, type: 'add' },
                        { themeId: 4, type: 'delete' },
                    ],
                },
            ],
        }));
    });

    it.each([
        ['empty selections', { selections: [] }],
        ['31 selections', {
            selections: Array.from({ length: 31 }, (_, requestId) => ({
                kind: 'word-request' as const,
                requestId: requestId + 1,
                selectedThemeIds: [1],
            })),
        }],
        ['non-positive request id', {
            selections: [{ kind: 'word-request' as const, requestId: 0, selectedThemeIds: [1] }],
        }],
        ['unsafe word id', {
            selections: [{ kind: 'theme-change' as const, wordId: Number.MAX_SAFE_INTEGER + 1, changes: [] }],
        }],
        ['non-positive theme id', {
            selections: [{ kind: 'word-request' as const, requestId: 1, selectedThemeIds: [0] }],
        }],
    ])('rejects %s', (_name, command) => {
        expect(normalizeWordRequestModerationCommand(command)).toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
    });

    it('rejects duplicate top-level request ids', () => {
        const result = normalizeWordRequestModerationCommand({
            selections: [
                { kind: 'word-request', requestId: 3, selectedThemeIds: [2] },
                { kind: 'word-request', requestId: 3, selectedThemeIds: [8] },
            ],
        });

        expect(result).toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
    });

    it('rejects duplicate and contradictory theme changes', () => {
        const duplicate = normalizeWordRequestModerationCommand({
            selections: [{
                kind: 'theme-change',
                wordId: 9,
                changes: [
                    { themeId: 2, type: 'add' },
                    { themeId: 2, type: 'add' },
                ],
            }],
        });
        const contradictory = normalizeWordRequestModerationCommand({
            selections: [{
                kind: 'theme-change',
                wordId: 9,
                changes: [
                    { themeId: 2, type: 'add' },
                    { themeId: 2, type: 'delete' },
                ],
            }],
        });

        expect(duplicate).toMatchObject({ ok: false, error: { kind: 'validation' } });
        expect(contradictory).toMatchObject({ ok: false, error: { kind: 'validation' } });
    });
});
