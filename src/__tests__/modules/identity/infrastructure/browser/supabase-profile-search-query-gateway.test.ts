jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseProfileSearchQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-search-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '사용자 검색 중 오류가 발생했습니다.',
});

const createGateway = (response: unknown, shouldThrow = false) => {
    const ilike = jest.fn();
    const select = jest.fn();
    const builder = {
        ilike,
        select,
        then: <TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => (shouldThrow
            ? Promise.reject(new Error('private query detail')).then(onfulfilled, onrejected)
            : Promise.resolve(response).then(onfulfilled, onrejected)),
    };
    ilike.mockReturnValue(builder);
    select.mockReturnValue(builder);
    const from = jest.fn((_table: 'users') => builder);

    return {
        from,
        gateway: new SupabaseProfileSearchQueryGateway({ from }),
        ilike,
        select,
    };
};

const validRow = (role: unknown = 'r2') => ({
    id: 'user-1',
    nickname: '테스터',
    role,
    contribution: 120,
    month_contribution: 12,
});

describe('SupabaseProfileSearchQueryGateway', () => {
    test('selects, filters, and maps only public profile search fields', async () => {
        // Break caught: exposing a full users row or changing the existing contains-search semantics.
        const { from, gateway, ilike, select } = createGateway({
            data: [validRow(null)],
            error: null,
        });

        await expect(gateway.searchByNickname('테스터')).resolves.toEqual(ok([{
            id: 'user-1',
            nickname: '테스터',
            role: 'guest',
            totalContribution: 120,
            monthlyContribution: 12,
        }]));
        expect(from).toHaveBeenCalledWith('users');
        expect(select).toHaveBeenCalledWith('id, nickname, role, contribution, month_contribution');
        expect(ilike).toHaveBeenCalledWith('nickname', '%테스터%');
    });

    test.each(['guest', 'r1', 'r2', 'r3', 'r4', 'admin'] as const)(
        'preserves the supported %s role',
        async (role) => {
            // Break caught: rejecting a role that identity presentation can render.
            const { gateway } = createGateway({ data: [validRow(role)], error: null });

            await expect(gateway.searchByNickname('테스터')).resolves.toEqual(ok([{
                id: 'user-1',
                nickname: '테스터',
                role,
                totalContribution: 120,
                monthlyContribution: 12,
            }]));
        },
    );

    test('preserves an empty result list', async () => {
        // Break caught: treating a legitimate no-match response as an infrastructure failure.
        const { gateway } = createGateway({ data: [], error: null });

        await expect(gateway.searchByNickname('없는사용자')).resolves.toEqual(ok([]));
    });

    test.each([
        ['a returned database error', { data: null, error: { message: 'private policy detail' } }, false],
        ['a thrown database query', null, true],
        ['a malformed ID', { data: [{ ...validRow(), id: null }], error: null }, false],
        ['a malformed nickname', { data: [{ ...validRow(), nickname: 1 }], error: null }, false],
        ['an unknown role', { data: [{ ...validRow(), role: 'owner' }], error: null }, false],
        ['a negative total contribution', { data: [{ ...validRow(), contribution: -1 }], error: null }, false],
        ['a fractional monthly contribution', { data: [{ ...validRow(), month_contribution: 1.5 }], error: null }, false],
        ['a malformed result array', { data: validRow(), error: null }, false],
    ])('maps %s to one stable public error', async (_description, response, shouldThrow) => {
        // Break caught: leaking PostgREST details or malformed data past the infrastructure boundary.
        const { gateway } = createGateway(response, shouldThrow);

        await expect(gateway.searchByNickname('테스터')).resolves.toEqual(stableError);
    });
});
