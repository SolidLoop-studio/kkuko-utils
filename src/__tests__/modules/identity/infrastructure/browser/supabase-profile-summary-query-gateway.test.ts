jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseProfileSummaryQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-summary-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
});

const validUser = (role: unknown = 'r2') => ({
    id: 'user-1',
    nickname: '테스터',
    role,
    contribution: 120,
    month_contribution: 42,
});

const createGateway = ({
    userResponse = { data: validUser(), error: null },
    rankResponse = { data: 3, error: null },
    historyResponse = { data: [], error: null },
    throwAt,
}: {
    userResponse?: unknown;
    rankResponse?: unknown;
    historyResponse?: unknown;
    throwAt?: 'user' | 'rank' | 'history';
} = {}) => {
    const maybeSingle = jest.fn(() => (
        throwAt === 'user' ? Promise.reject(new Error('private user detail')) : Promise.resolve(userResponse)
    ));
    const userEq = jest.fn(() => ({ maybeSingle }));
    const userSelect = jest.fn(() => ({ eq: userEq }));

    const limit = jest.fn(() => (
        throwAt === 'history' ? Promise.reject(new Error('private history detail')) : Promise.resolve(historyResponse)
    ));
    const order = jest.fn(() => ({ limit }));
    const historyEq = jest.fn(() => ({ order }));
    const historySelect = jest.fn(() => ({ eq: historyEq }));
    const from = jest.fn((table: 'users' | 'user_month_contributions') => (
        table === 'users' ? { select: userSelect } : { select: historySelect }
    ));
    const rpc = jest.fn(() => (
        throwAt === 'rank' ? Promise.reject(new Error('private rank detail')) : Promise.resolve(rankResponse)
    ));

    return {
        gateway: new SupabaseProfileSummaryQueryGateway({ from, rpc } as never),
        from,
        rpc,
        userSelect,
        userEq,
        maybeSingle,
        historySelect,
        historyEq,
        order,
        limit,
    };
};

describe('SupabaseProfileSummaryQueryGateway', () => {
    test('stops after a missing user without loading rank or history', async () => {
        // Break caught: running profile-dependent queries when the lookup found no profile.
        const { gateway, rpc, from } = createGateway({ userResponse: { data: null, error: null } });

        await expect(gateway.loadByNickname('없는사용자')).resolves.toEqual(ok(null));
        expect(rpc).not.toHaveBeenCalled();
        expect(from).toHaveBeenCalledTimes(1);
    });

    test('runs the canonical queries and maps a validated camelCase source DTO', async () => {
        // Break caught: changing the public fields, query policy, or ISO month normalization at this boundary.
        const {
            gateway,
            from,
            rpc,
            userSelect,
            userEq,
            historySelect,
            historyEq,
            order,
            limit,
        } = createGateway({
            userResponse: { data: validUser(null), error: null },
            rankResponse: { data: 3, error: null },
            historyResponse: {
                data: [
                    { month: '2026-08-01T00:00:00.000Z', contribution: 8 },
                    { month: '2026-07-01', contribution: 7 },
                ],
                error: null,
            },
        });

        await expect(gateway.loadByNickname('테스터')).resolves.toEqual(ok({
            id: 'user-1',
            nickname: '테스터',
            role: 'guest',
            totalContribution: 120,
            monthlyContribution: 42,
            monthlyContributionRank: 3,
            historicalMonthlyContributions: [
                { month: '2026-08', contribution: 8 },
                { month: '2026-07', contribution: 7 },
            ],
        }));
        expect(from).toHaveBeenNthCalledWith(1, 'users');
        expect(userSelect).toHaveBeenCalledWith('id, nickname, role, contribution, month_contribution');
        expect(userEq).toHaveBeenCalledWith('nickname', '테스터');
        expect(rpc).toHaveBeenCalledWith('get_user_monthly_rank', { uid: 'user-1' });
        expect(from).toHaveBeenNthCalledWith(2, 'user_month_contributions');
        expect(historySelect).toHaveBeenCalledWith('month, contribution');
        expect(historyEq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(order).toHaveBeenCalledWith('month', { ascending: false });
        expect(limit).toHaveBeenCalledWith(4);
    });

    test.each([
        ['a returned user query error', { data: null, error: { message: 'private user detail' } }, undefined, undefined, undefined],
        ['a thrown user query', undefined, undefined, undefined, 'user'],
        ['a malformed user row', { data: { ...validUser(), contribution: -1 }, error: null }, undefined, undefined, undefined],
        ['a returned rank error', undefined, { data: null, error: { message: 'private rank detail' } }, undefined, undefined],
        ['a thrown rank query', undefined, undefined, undefined, 'rank'],
        ['a fractional rank', undefined, { data: 1.5, error: null }, undefined, undefined],
        ['a returned history error', undefined, undefined, { data: null, error: { message: 'private history detail' } }, undefined],
        ['a thrown history query', undefined, undefined, undefined, 'history'],
        ['a malformed history row', undefined, undefined, { data: [{ month: '2026-13-01', contribution: 1 }], error: null }, undefined],
        ['a negative history contribution', undefined, undefined, { data: [{ month: '2026-08-01', contribution: -1 }], error: null }, undefined],
    ])('maps %s to one stable public error', async (
        _description,
        userResponse,
        rankResponse,
        historyResponse,
        throwAt,
    ) => {
        // Break caught: leaking database details or accepting malformed values outside infrastructure.
        const { gateway } = createGateway({
            userResponse,
            rankResponse,
            historyResponse,
            throwAt: throwAt as 'user' | 'rank' | 'history' | undefined,
        });

        await expect(gateway.loadByNickname('테스터')).resolves.toEqual(stableError);
    });
});
