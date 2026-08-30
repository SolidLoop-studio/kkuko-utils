jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseNicknameQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-nickname-query-gateway';
import { ok } from '@/src/shared/application/result';

type QueryResponse = { data?: unknown; error?: unknown };

const createGateway = () => {
    let response: QueryResponse = { data: [], error: null };
    const eq = jest.fn(() => Promise.resolve(response));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    const gateway = new SupabaseNicknameQueryGateway({ from });
    return {
        eq,
        from,
        gateway,
        select,
        setResponse: (next: QueryResponse) => { response = next; },
    };
};

describe('SupabaseNicknameQueryGateway', () => {
    it('reports zero exact nickname rows as available through a minimal query', async () => {
        // Break caught: broad row selection or fuzzy matching changing availability semantics.
        const { eq, from, gateway, select } = createGateway();

        await expect(gateway.isAvailable('테스터')).resolves.toEqual(ok(true));
        expect(from).toHaveBeenCalledWith('users');
        expect(select).toHaveBeenCalledWith('id');
        expect(eq).toHaveBeenCalledWith('nickname', '테스터');
    });

    it('reports exactly one valid row as unavailable', async () => {
        // Break caught: treating an existing nickname as available.
        const { gateway, setResponse } = createGateway();
        setResponse({ data: [{ id: 'user-1' }], error: null });

        await expect(gateway.isAvailable('테스터')).resolves.toEqual(ok(false));
    });

    it.each([
        ['missing data', { error: null }],
        ['non-array data', { data: { id: 'user-1' }, error: null }],
        ['a malformed row', { data: [{ id: 17 }], error: null }],
        ['duplicate rows', { data: [{ id: 'user-1' }, { id: 'user-2' }], error: null }],
    ])('rejects %s instead of guessing availability', async (_description, response) => {
        // Break caught: silently accepting a response that violates the unique-row query contract.
        const { gateway, setResponse } = createGateway();
        setResponse(response);

        await expect(gateway.isAvailable('테스터')).resolves.toMatchObject({
            ok: false,
            error: { kind: 'infrastructure', message: '닉네임 확인 중 오류가 발생했습니다.' },
        });
    });

    it('never exposes returned or thrown database details', async () => {
        // Break caught: forwarding PostgREST text to presentation.
        const returned = createGateway();
        returned.setResponse({ data: null, error: { message: 'private database detail' } });
        const thrownFrom = jest.fn(() => { throw new Error('private thrown detail'); });

        const returnedResult = await returned.gateway.isAvailable('테스터');
        const thrownResult = await new SupabaseNicknameQueryGateway({ from: thrownFrom })
            .isAvailable('테스터');

        expect(returnedResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(thrownResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        if (!returnedResult.ok) expect(returnedResult.error.message).not.toContain('private');
        if (!thrownResult.ok) expect(thrownResult.error.message).not.toContain('private');
    });
});
