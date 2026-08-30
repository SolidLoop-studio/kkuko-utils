jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseProfileWordRequestsQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-word-requests-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.',
});

const createGateway = ({
    response = {
        data: [{
            id: 42,
            word: '테스트단어',
            request_type: 'add',
            requested_at: '2026-08-27T00:00:00.000Z',
            status: 'pending',
        }],
        error: null,
    },
    throws = false,
}: { response?: unknown; throws?: boolean } = {}) => {
    const limit = jest.fn(() => (
        throws ? Promise.reject(new Error('private database detail')) : Promise.resolve(response)
    ));
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));

    return {
        gateway: new SupabaseProfileWordRequestsQueryGateway({ from } as never),
        from,
        select,
        eq,
        order,
        limit,
    };
};

describe('SupabaseProfileWordRequestsQueryGateway', () => {
    test('queries a profile requester history newest first and maps rows to the narrow camelCase projection', async () => {
        // Break caught: changing request scope/order/limit or exposing database-shaped rows past infrastructure.
        const { gateway, from, select, eq, order, limit } = createGateway({
            response: {
                data: [
                    { id: 9, word: '최신단어', request_type: 'delete', requested_at: '2026-08-27T00:00:00.000Z', status: 'approved' },
                    { id: 2, word: '이전단어', request_type: 'add', requested_at: '2026-08-26T00:00:00.000Z', status: 'rejected' },
                ],
                error: null,
            },
        });

        await expect(gateway.loadByRequesterId('user-1')).resolves.toEqual(ok([
            { id: 9, word: '최신단어', requestType: 'delete', requestedAt: '2026-08-27T00:00:00.000Z', status: 'approved' },
            { id: 2, word: '이전단어', requestType: 'add', requestedAt: '2026-08-26T00:00:00.000Z', status: 'rejected' },
        ]));
        expect(from).toHaveBeenCalledWith('wait_words');
        expect(select).toHaveBeenCalledWith('id, word, request_type, requested_at, status');
        expect(eq).toHaveBeenCalledWith('requested_by', 'user-1');
        expect(order).toHaveBeenCalledWith('requested_at', { ascending: false });
        expect(limit).toHaveBeenCalledWith(30);
    });

    test.each([
        ['a returned query error', { data: null, error: { message: 'private database detail' } }, false],
        ['a thrown query error', undefined, true],
        ['a malformed request row', { data: [{ id: 0, word: '단어', request_type: 'add', requested_at: '2026-08-27', status: 'pending' }], error: null }, false],
        ['an unsupported request type', { data: [{ id: 1, word: '단어', request_type: 'update', requested_at: '2026-08-27', status: 'pending' }], error: null }, false],
        ['an unsupported request status', { data: [{ id: 1, word: '단어', request_type: 'add', requested_at: '2026-08-27', status: 'cancelled' }], error: null }, false],
    ])('maps %s to one stable public error', async (_description, response, throws) => {
        // Break caught: leaking database diagnostics or accepting malformed request rows outside infrastructure.
        const { gateway } = createGateway({ response, throws });

        await expect(gateway.loadByRequesterId('user-1')).resolves.toEqual(stableError);
    });
});
