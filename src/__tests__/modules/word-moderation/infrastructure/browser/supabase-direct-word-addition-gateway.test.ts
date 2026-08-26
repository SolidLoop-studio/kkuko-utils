jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseDirectWordAdditionGateway } from '@/src/modules/word-moderation/infrastructure/browser/supabase-direct-word-addition-gateway';
import { ok } from '@/src/shared/application/result';

type RpcResponse = {
    data: unknown;
    error: { code?: string | null; message: string } | null;
};

type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

const responseData = {
    wordId: 31,
    word: '사과',
    noinCanUse: true,
    themeIds: [4, 9],
    affectedDocsIds: [10, 20],
};

const createGateway = () => {
    const rpc: Rpc = jest.fn();
    return { rpc, gateway: new SupabaseDirectWordAdditionGateway({ rpc }) };
};

describe('SupabaseDirectWordAdditionGateway', () => {
    it('calls the atomic RPC with normalized word and theme codes only', async () => {
        const { rpc, gateway } = createGateway();
        rpc.mockResolvedValue({ data: responseData, error: null });

        await expect(gateway.add({ word: '사과', themeCodes: ['animal', 'place'] }))
            .resolves.toEqual(ok(responseData));
        expect(rpc).toHaveBeenCalledWith('add_word_directly', {
            p_word: '사과',
            p_theme_codes: ['animal', 'place'],
        });
    });

    it.each([
        ['DIRECT_WORD_ADDITION_UNAUTHORIZED', 'unauthorized'],
        ['DIRECT_WORD_ADDITION_FORBIDDEN', 'forbidden'],
        ['DIRECT_WORD_ADDITION_INVALID_INPUT', 'validation'],
        ['DIRECT_WORD_ADDITION_INVALID_THEME', 'validation'],
        ['DIRECT_WORD_ADDITION_DUPLICATE', 'conflict'],
        ['DIRECT_WORD_ADDITION_INTERNAL_ERROR', 'infrastructure'],
    ])('maps %s to a safe %s error', async (message, kind) => {
        const { rpc, gateway } = createGateway();
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } });

        const result = await gateway.add({ word: '사과', themeCodes: [] });

        expect(result).toMatchObject({ ok: false, error: { kind, code: 'P0001' } });
        if (!result.ok) expect(result.error.message).not.toBe(message);
    });

    it('does not expose unknown database errors or thrown details', async () => {
        const { rpc, gateway } = createGateway();
        rpc.mockResolvedValueOnce({
            data: null,
            error: { code: 'XX999', message: 'sensitive database detail' },
        });
        rpc.mockRejectedValueOnce(new Error('sensitive thrown detail'));

        const returned = await gateway.add({ word: '사과', themeCodes: [] });
        const thrown = await gateway.add({ word: '사과', themeCodes: [] });

        expect(returned).toMatchObject({ ok: false, error: { kind: 'infrastructure', code: 'XX999' } });
        expect(thrown).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        if (!returned.ok) expect(returned.error.message).not.toContain('sensitive');
        if (!thrown.ok) expect(thrown.error.message).not.toContain('sensitive');
    });

    it.each([
        ['a missing word ID', { ...responseData, wordId: undefined }],
        ['a different word', { ...responseData, word: '바나나' }],
        ['an invalid noin flag', { ...responseData, noinCanUse: 'yes' }],
        ['duplicate theme IDs', { ...responseData, themeIds: [4, 4] }],
        ['unsorted docs IDs', { ...responseData, affectedDocsIds: [20, 10] }],
    ])('rejects %s in the RPC result', async (_description, data) => {
        const { rpc, gateway } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.add({ word: '사과', themeCodes: ['animal', 'place'] }))
            .resolves.toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
    });
});
