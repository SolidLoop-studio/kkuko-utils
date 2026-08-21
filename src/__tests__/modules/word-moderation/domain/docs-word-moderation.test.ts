import { ok } from '@/src/shared/application/result';
import {
    normalizeDeleteWordDirectlyCommand,
    normalizeDocsWordMutationTargetsQuery,
    toModerateWordRequestsCommand,
    type DocsWordMutationTarget,
} from '@/src/modules/word-moderation/domain/docs-word-moderation';

describe('docs word moderation domain', () => {
    it('maps a normalized word request target to the shared moderation command', () => {
        const target: DocsWordMutationTarget = {
            kind: 'word-request',
            requestId: 7,
            requestType: 'add',
            selectedThemeIds: [9, 3, 9],
        };

        expect(toModerateWordRequestsCommand(target)).toEqual(ok({
            selections: [{ kind: 'word-request', requestId: 7, selectedThemeIds: [3, 9] }],
        }));
    });

    it('maps a theme change target to the shared moderation command', () => {
        expect(toModerateWordRequestsCommand({
            kind: 'theme-change',
            wordId: 11,
            themeId: 13,
            type: 'delete',
        })).toEqual(ok({
            selections: [{
                kind: 'theme-change',
                wordId: 11,
                changes: [{ themeId: 13, type: 'delete' }],
            }],
        }));
    });

    it('does not convert a registered word target to a request moderation command', () => {
        expect(toModerateWordRequestsCommand({ kind: 'registered-word', wordId: 11 })).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'target' },
        });
    });

    it('normalizes a complete query into stable target rows', () => {
        expect(normalizeDocsWordMutationTargetsQuery({
            docsId: 4,
            rows: [
                { word: '가나다', status: 'add' },
                { word: '라마', status: 'ok' },
                { word: '바사', status: 'delete' },
            ],
        })).toEqual(ok({
            docsId: 4,
            rows: [
                { word: '가나다', status: 'add' },
                { word: '라마', status: 'ok' },
                { word: '바사', status: 'delete' },
            ],
        }));
    });

    it.each([
        ['a non-positive docs id', { docsId: 0, rows: [] }, 'docsId'],
        ['an unsafe docs id', { docsId: Number.MAX_SAFE_INTEGER + 1, rows: [] }, 'docsId'],
        ['a missing rows array', { docsId: 1 }, 'rows'],
        ['a blank row word', { docsId: 1, rows: [{ word: '', status: 'add' }] }, 'word'],
        ['a row word with surrounding whitespace', { docsId: 1, rows: [{ word: ' 가나다 ', status: 'add' }] }, 'word'],
        ['an unsupported row status', { docsId: 1, rows: [{ word: '가나다', status: 'pending' }] }, 'status'],
    ] as Array<[string, unknown, string]>)('rejects %s', (_name, query, field) => {
        expect(normalizeDocsWordMutationTargetsQuery(query)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });

    it.each([
        ['a non-positive direct deletion word id', { wordId: 0 }, 'wordId'],
        ['an unsafe direct deletion word id', { wordId: Number.MAX_SAFE_INTEGER + 1 }, 'wordId'],
        ['a malformed direct deletion command', {}, 'wordId'],
    ] as Array<[string, unknown, string]>)('rejects %s', (_name, command, field) => {
        expect(normalizeDeleteWordDirectlyCommand(command)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });

    it.each([
        ['an invalid request id', {
            kind: 'word-request', requestId: 0, requestType: 'add', selectedThemeIds: [],
        }, 'requestId'],
        ['an unsupported request type', {
            kind: 'word-request', requestId: 1, requestType: 'ok', selectedThemeIds: [],
        }, 'requestType'],
        ['an invalid selected theme id', {
            kind: 'word-request', requestId: 1, requestType: 'delete', selectedThemeIds: [0],
        }, 'selectedThemeIds'],
        ['an invalid theme-change word id', {
            kind: 'theme-change', wordId: 0, themeId: 2, type: 'add',
        }, 'wordId'],
        ['an invalid theme-change theme id', {
            kind: 'theme-change', wordId: 1, themeId: 0, type: 'add',
        }, 'themeId'],
        ['an unsupported theme-change type', {
            kind: 'theme-change', wordId: 1, themeId: 2, type: 'ok',
        }, 'type'],
        ['an invalid registered-word id', { kind: 'registered-word', wordId: 0 }, 'wordId'],
        ['an unsupported target kind', { kind: 'unexpected', wordId: 1 }, 'kind'],
    ] as Array<[string, unknown, string]>)('rejects %s while mapping a target', (_name, target, field) => {
        expect(toModerateWordRequestsCommand(target)).toMatchObject({
            ok: false,
            error: { kind: 'validation', field },
        });
    });
});
