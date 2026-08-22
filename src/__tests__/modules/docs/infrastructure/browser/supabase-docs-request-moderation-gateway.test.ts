import type {
    ApproveDocsRequestsCommand,
    RejectDocsRequestsCommand,
} from '@/src/modules/docs/application/docs-request-moderation-types';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseDocsRequestModerationGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-request-moderation-gateway';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

const approveCommand: ApproveDocsRequestsCommand = {
    selections: [{ requestId: 11, duem: true }],
};

const rejectCommand: RejectDocsRequestsCommand = {
    requestIds: [11, 22],
};

const successfulResult = {
    processedRequestIds: [22, 11],
    processedRequestCount: 2,
};

const infrastructureError = {
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
};

const createGateway = () => {
    const rpc: Rpc = jest.fn();
    return {
        rpc,
        gateway: new SupabaseDocsRequestModerationGateway({ rpc }),
    };
};

describe('SupabaseDocsRequestModerationGateway', () => {
    it('approves selections through the approval RPC and normalizes its result', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: successfulResult, error: null });

        await expect(gateway.approve(approveCommand)).resolves.toEqual({
            ok: true,
            value: {
                processedRequestIds: [11, 22],
                processedRequestCount: 2,
            },
        });
        expect(rpc).toHaveBeenCalledWith('approve_docs_requests', {
            p_selections: [{ requestId: 11, duem: true }],
        });
    });

    it('rejects request IDs through the rejection RPC', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: successfulResult, error: null });

        await expect(gateway.reject(rejectCommand)).resolves.toEqual({
            ok: true,
            value: {
                processedRequestIds: [11, 22],
                processedRequestCount: 2,
            },
        });
        expect(rpc).toHaveBeenCalledWith('reject_docs_requests', {
            p_request_ids: [11, 22],
        });
    });

    it.each([
        ['duplicate processed request IDs', { ...successfulResult, processedRequestIds: [11, 11] }],
        ['a mismatched processed request count', { ...successfulResult, processedRequestCount: 1 }],
        ['a negative processed request ID', { ...successfulResult, processedRequestIds: [-1] }],
        ['a non-object response', null],
    ])('returns a safe infrastructure error for %s', async (_description, data) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.approve(approveCommand)).resolves.toEqual({
            ok: false,
            error: infrastructureError,
        });
    });

    it('returns a safe infrastructure error when the RPC throws', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockRejectedValue(new Error('sensitive database implementation detail'));

        await expect(gateway.reject(rejectCommand)).resolves.toEqual({
            ok: false,
            error: infrastructureError,
        });
    });

    it.each([
        ['DOCS_REQUEST_MODERATION_UNAUTHORIZED', 'unauthorized', '인증이 필요합니다.'],
        ['DOCS_REQUEST_MODERATION_FORBIDDEN', 'forbidden', '권한이 없습니다.'],
        ['DOCS_REQUEST_MODERATION_INVALID_INPUT', 'validation', '입력값이 올바르지 않습니다.'],
        ['DOCS_REQUEST_MODERATION_CONFLICT', 'conflict', '요청이 이미 처리되었거나 충돌이 발생했습니다.'],
        ['DOCS_REQUEST_MODERATION_INTERNAL_ERROR', 'infrastructure', '데이터 처리 중 오류가 발생했습니다.'],
    ])('maps the public %s database code to a safe %s application error', async (
        message,
        kind,
        safeMessage,
    ) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message },
        });

        await expect(gateway.approve(approveCommand)).resolves.toEqual({
            ok: false,
            error: { kind, message: safeMessage, code: 'P0001' },
        });
    });

    it('sanitizes an unknown RPC error', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST999', message: 'sensitive database implementation detail' },
        });

        await expect(gateway.reject(rejectCommand)).resolves.toEqual({
            ok: false,
            error: {
                ...infrastructureError,
                code: 'PGRST999',
            },
        });
    });

    it('does not map a stable code owned by another feature', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'WORD_APPROVAL_UNAUTHORIZED' },
        });

        await expect(gateway.reject(rejectCommand)).resolves.toEqual({
            ok: false,
            error: {
                ...infrastructureError,
                code: 'P0001',
            },
        });
    });
});
