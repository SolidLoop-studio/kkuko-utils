jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseProfileProcessedRequestsQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-processed-requests-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '처리된 요청을 불러오는 중 오류가 발생했습니다.',
});

const createGateway = ({
    response = {
        data: [{
            id: 43,
            word: '처리단어',
            created_at: '2026-08-27T00:00:00.000Z',
            state: 'approved',
            r_type: 'delete',
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
        gateway: new SupabaseProfileProcessedRequestsQueryGateway({ from } as never),
        from,
        select,
        eq,
        order,
        limit,
    };
};

describe('SupabaseProfileProcessedRequestsQueryGateway', () => {
    test('queries a profile maker history newest first and maps rows to the narrow camelCase projection', async () => {
        // Break caught: changing log scope/order/limit or exposing database-shaped rows past infrastructure.
        const { gateway, from, select, eq, order, limit } = createGateway({
            response: {
                data: [
                    { id: 9, word: '최신처리', created_at: '2026-08-27T00:00:00.000Z', state: 'approved', r_type: 'delete' },
                    { id: 2, word: '이전처리', created_at: '2026-08-26T00:00:00.000Z', state: 'rejected', r_type: 'add' },
                ],
                error: null,
            },
        });

        await expect(gateway.loadByMakerId('user-1')).resolves.toEqual(ok([
            { id: 9, word: '최신처리', createdAt: '2026-08-27T00:00:00.000Z', state: 'approved', requestType: 'delete' },
            { id: 2, word: '이전처리', createdAt: '2026-08-26T00:00:00.000Z', state: 'rejected', requestType: 'add' },
        ]));
        expect(from).toHaveBeenCalledWith('logs');
        expect(select).toHaveBeenCalledWith('id, word, created_at, state, r_type');
        expect(eq).toHaveBeenCalledWith('make_by', 'user-1');
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(limit).toHaveBeenCalledWith(30);
    });

    test.each([
        ['a returned query error', { data: null, error: { message: 'private database detail' } }, false],
        ['a thrown query error', undefined, true],
        ['a malformed processed row', { data: [{ id: 0, word: '단어', created_at: '2026-08-27', state: 'approved', r_type: 'add' }], error: null }, false],
        ['an unsupported request type', { data: [{ id: 1, word: '단어', created_at: '2026-08-27', state: 'approved', r_type: 'update' }], error: null }, false],
        ['an unsupported request state', { data: [{ id: 1, word: '단어', created_at: '2026-08-27', state: 'cancelled', r_type: 'add' }], error: null }, false],
    ])('maps %s to one stable public error', async (_description, response, throws) => {
        // Break caught: leaking database diagnostics or accepting malformed log rows outside infrastructure.
        const { gateway } = createGateway({ response, throws });

        await expect(gateway.loadByMakerId('user-1')).resolves.toEqual(stableError);
    });
});
