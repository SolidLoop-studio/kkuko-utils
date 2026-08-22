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
