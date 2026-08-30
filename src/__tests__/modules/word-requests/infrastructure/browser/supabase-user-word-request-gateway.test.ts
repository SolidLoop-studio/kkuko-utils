import { err, ok } from '@/src/shared/application/result';
import type { ApplicationError } from '@/src/shared/application/application-error';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseUserWordRequestGateway } from '@/src/modules/word-requests/infrastructure/browser/supabase-user-word-request-gateway';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

const deletionResult = { requestId: 11, word: '나비', requestType: 'delete' };
const additionResult = {
    requestId: 10,
    word: '가방',
    requestType: 'add',
    themes: [
        { themeCode: 'animal', themeName: '동물' },
        { themeCode: 'place', themeName: '지명' },
    ],
};
const additionBatchResult = {
    requestedWordCount: 2,
    createdWordRequestCount: 1,
    updatedWordRequestCount: 0,
    changedRegisteredWordCount: 1,
    createdThemeChangeRequestCount: 2,
    unchangedWordCount: 0,
};

const infrastructureError: ApplicationError = {
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
};

const createGateway = () => {
    const rpc: Rpc = jest.fn();
    return {
        rpc,
        gateway: new SupabaseUserWordRequestGateway({ rpc }),
    };
};

describe('SupabaseUserWordRequestGateway', () => {
    it('requests addition through request_word_addition with the word and theme codes', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: additionResult, error: null });

        await expect(gateway.requestAddition({
            word: '가방',
            themeCodes: ['animal', 'place'],
        })).resolves.toEqual(ok(additionResult));
        expect(rpc).toHaveBeenCalledWith('request_word_addition', {
            p_word: '가방',
            p_theme_codes: ['animal', 'place'],
        });
    });

    it('requests an addition batch through request_word_additions', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: additionBatchResult, error: null });
        const command = {
            entries: [
                { word: '가방', themeCodes: [] },
                { word: '나비', themeCodes: ['animal', 'place'] },
            ],
        };

        await expect(gateway.requestAdditions(command)).resolves.toEqual(ok(additionBatchResult));
        expect(rpc).toHaveBeenCalledWith('request_word_additions', {
            p_entries: command.entries,
        });
    });

    it('uses atomic chunks and aggregates a safely resumable large batch', async () => {
        const { gateway, rpc } = createGateway();
        const onProgress = jest.fn();
        rpc
            .mockResolvedValueOnce({
                data: {
                    requestedWordCount: 300,
                    createdWordRequestCount: 300,
                    updatedWordRequestCount: 0,
                    changedRegisteredWordCount: 0,
                    createdThemeChangeRequestCount: 0,
                    unchangedWordCount: 0,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    requestedWordCount: 1,
                    createdWordRequestCount: 1,
                    updatedWordRequestCount: 0,
                    changedRegisteredWordCount: 0,
                    createdThemeChangeRequestCount: 0,
                    unchangedWordCount: 0,
                },
                error: null,
            });
        const entries = Array.from({ length: 301 }, (_, index) => ({
            word: `단어-${index.toString().padStart(3, '0')}`,
            themeCodes: [],
        }));

        await expect(gateway.requestAdditions({ entries }, onProgress)).resolves.toEqual(ok({
            requestedWordCount: 301,
            createdWordRequestCount: 301,
            updatedWordRequestCount: 0,
            changedRegisteredWordCount: 0,
            createdThemeChangeRequestCount: 0,
            unchangedWordCount: 0,
        }));
        expect(rpc).toHaveBeenCalledTimes(2);
        expect(rpc.mock.calls[0][1].p_entries).toHaveLength(300);
        expect(rpc.mock.calls[1][1].p_entries).toHaveLength(1);
        expect(onProgress.mock.calls).toEqual([
            [{ completedWordCount: 300, totalWordCount: 301 }],
            [{ completedWordCount: 301, totalWordCount: 301 }],
        ]);
    });

    it.each([
        ['a mismatched requested count', { ...additionBatchResult, requestedWordCount: 1 }],
        ['a negative count', { ...additionBatchResult, unchangedWordCount: -1 }],
        ['inconsistent outcome counts', { ...additionBatchResult, unchangedWordCount: 1 }],
    ])('returns an infrastructure error when batch response has %s', async (_description, data) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.requestAdditions({
            entries: [
                { word: '가방', themeCodes: [] },
                { word: '나비', themeCodes: ['animal', 'place'] },
            ],
        })).resolves.toEqual(err(infrastructureError));
    });

    it('requests deletion through request_word_deletion with only the word', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: deletionResult, error: null });

        await expect(gateway.requestDeletion({ word: '나비' })).resolves.toEqual(ok(deletionResult));
        expect(rpc).toHaveBeenCalledWith('request_word_deletion', { p_word: '나비' });
    });

    it('cancels through cancel_word_request with only the word', async () => {
        const { gateway, rpc } = createGateway();
        const cancellationResult = { requestId: 12, word: '가방', requestType: 'add' };
        rpc.mockResolvedValue({ data: cancellationResult, error: null });

        await expect(gateway.cancel({ word: '가방' })).resolves.toEqual(ok(cancellationResult));
        expect(rpc).toHaveBeenCalledWith('cancel_word_request', { p_word: '가방' });
    });

    it.each([
        ['a malformed object', { requestId: 11, word: '나비' }],
        ['a non-positive request ID', { ...deletionResult, requestId: 0 }],
        ['an unsafe request ID', { ...deletionResult, requestId: Number.MAX_SAFE_INTEGER + 1 }],
        ['a word different from the command', { ...deletionResult, word: '고래' }],
        ['an invalid request type', { ...deletionResult, requestType: 'change' }],
    ])('returns an infrastructure error for %s response data', async (_description, data) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.requestDeletion({ word: '나비' })).resolves.toEqual(err(infrastructureError));
    });

    it.each([
        ['themes are missing', { ...additionResult, themes: undefined }],
        ['a theme name is blank', {
            ...additionResult,
            themes: [{ themeCode: 'animal', themeName: ' ' }],
        }],
        ['a requested theme is missing', {
            ...additionResult,
            themes: [{ themeCode: 'animal', themeName: '동물' }],
        }],
        ['an unrequested theme is returned', {
            ...additionResult,
            themes: [
                { themeCode: 'animal', themeName: '동물' },
                { themeCode: 'other', themeName: '기타' },
            ],
        }],
        ['themes are not sorted', {
            ...additionResult,
            themes: [...additionResult.themes].reverse(),
        }],
    ])('returns an infrastructure error when addition response %s', async (_description, data) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.requestAddition({
            word: '가방',
            themeCodes: ['animal', 'place'],
        })).resolves.toEqual(err(infrastructureError));
    });

    it('returns an infrastructure error when RPC throws', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockRejectedValue(new Error('sensitive database implementation detail'));

        await expect(gateway.cancel({ word: '가방' })).resolves.toEqual(err(infrastructureError));
    });

    it('returns an infrastructure error without exposing an unknown database error message', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST999', message: 'sensitive database implementation detail' },
        });

        await expect(gateway.cancel({ word: '가방' })).resolves.toEqual(err({
            ...infrastructureError,
            code: 'PGRST999',
        }));
    });

    it('returns an infrastructure error for an inherited error-kind key', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'constructor' },
        });

        await expect(gateway.requestDeletion({ word: '나비' })).resolves.toEqual(err({
            ...infrastructureError,
            code: 'P0001',
        }));
    });

    it.each([
        ['WORD_REQUEST_UNAUTHORIZED', 'unauthorized'],
        ['WORD_REQUEST_INVALID_INPUT', 'validation'],
        ['WORD_REQUEST_NOT_FOUND', 'not-found'],
        ['WORD_REQUEST_CONFLICT', 'conflict'],
        ['WORD_REQUEST_FORBIDDEN', 'forbidden'],
        ['WORD_REQUEST_INTERNAL_ERROR', 'infrastructure'],
        ['WORD_REQUEST_ALREADY_REGISTERED', 'conflict'],
        ['WORD_REQUEST_INVALID_THEME', 'validation'],
        ['WORD_ADDITION_BATCH_UNAUTHORIZED', 'unauthorized'],
        ['WORD_ADDITION_BATCH_INVALID_INPUT', 'validation'],
        ['WORD_ADDITION_BATCH_INVALID_THEME', 'validation'],
        ['WORD_ADDITION_BATCH_CONFLICT', 'conflict'],
        ['WORD_ADDITION_BATCH_INTERNAL_ERROR', 'infrastructure'],
    ])('maps public %s database errors to a safe %s application error', async (message, kind) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message },
        });

        const result = await gateway.requestDeletion({ word: '나비' });

        expect(result).toMatchObject({ ok: false, error: { kind, code: 'P0001' } });
        if (!result.ok) {
            expect(result.error.message).not.toBe(message);
        }
    });
});
