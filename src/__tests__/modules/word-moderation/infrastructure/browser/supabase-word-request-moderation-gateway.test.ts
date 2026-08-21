import type { ModerateWordRequestsCommand } from '@/src/modules/word-moderation/application/word-request-moderation-types';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string; cause?: unknown } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseWordRequestModerationGateway } from '../../../../../modules/word-moderation/infrastructure/browser/supabase-word-request-moderation-gateway';

const rpc = (
    jest.requireMock('../../../../../shared/infrastructure/supabase/browser-client') as {
        browserSupabaseClient: { rpc: Rpc };
    }
).browserSupabaseClient.rpc;

const command: ModerateWordRequestsCommand = {
    selections: [
        { kind: 'word-request', requestId: 3, selectedThemeIds: [4, 8] },
        {
            kind: 'theme-change',
            wordId: 9,
            changes: [{ themeId: 12, type: 'add' }],
        },
    ],
};

const successfulResult = {
    processedWordRequestCount: 2,
    processedThemeChangeCount: 1,
    affectedDocsIds: [18, 12],
};

describe('SupabaseWordRequestModerationGateway', () => {
    const gateway = new SupabaseWordRequestModerationGateway();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('approves selections through the approval RPC and returns a normalized result', async () => {
        rpc.mockResolvedValue({ data: successfulResult, error: null });

        await expect(gateway.approve(command)).resolves.toEqual({
            ok: true,
            value: {
                processedWordRequestCount: 2,
                processedThemeChangeCount: 1,
                affectedDocsIds: [12, 18],
            },
        });
        expect(rpc).toHaveBeenCalledWith('approve_word_requests', {
            p_selections: command.selections,
        });
    });

    it('rejects selections through the rejection RPC and supports an empty affected document list', async () => {
        rpc.mockResolvedValue({
            data: {
                processedWordRequestCount: 1,
                processedThemeChangeCount: 0,
                affectedDocsIds: [],
            },
            error: null,
        });

        await expect(gateway.reject(command)).resolves.toEqual({
            ok: true,
            value: {
                processedWordRequestCount: 1,
                processedThemeChangeCount: 0,
                affectedDocsIds: [],
            },
        });
        expect(rpc).toHaveBeenCalledWith('reject_word_requests', {
            p_selections: command.selections,
        });
    });

    it.each([
        ['negative word-request count', { ...successfulResult, processedWordRequestCount: -1 }],
        ['non-integer theme-change count', { ...successfulResult, processedThemeChangeCount: '1' }],
        ['duplicate document IDs', { ...successfulResult, affectedDocsIds: [12, 12] }],
        ['non-integer document ID', { ...successfulResult, affectedDocsIds: [12, 1.5] }],
        ['non-positive document ID', { ...successfulResult, affectedDocsIds: [0] }],
        ['non-object response', null],
    ])('returns a safe infrastructure error for %s', async (_description, data) => {
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.approve(command)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '데이터 처리 중 오류가 발생했습니다.',
            },
        });
    });

    it.each([
        ['UNAUTHORIZED', 'unauthorized'],
        ['FORBIDDEN', 'forbidden'],
        ['INVALID_INPUT', 'validation'],
        ['CONFLICT', 'conflict'],
        ['INTERNAL_ERROR', 'infrastructure'],
    ])('maps the %s RPC error to a %s application error', async (message, kind) => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message },
        });

        await expect(gateway.approve(command)).resolves.toMatchObject({
            ok: false,
            error: { kind },
        });
    });

    it('sanitizes an unexpected PostgREST error', async () => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST999', message: 'sensitive database implementation detail' },
        });

        await expect(gateway.reject(command)).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '데이터 처리 중 오류가 발생했습니다.',
                code: 'PGRST999',
            },
        });
    });
});
