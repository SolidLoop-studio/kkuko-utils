jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import type { AdminUserListSort } from '@/src/modules/admin-users/application/admin-user-list-types';
import { SupabaseAdminUserListQueryGateway } from '@/src/modules/admin-users/infrastructure/browser/supabase-admin-user-list-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
});

const selectColumns = 'id, nickname, role, contribution, month_contribution';
const validResponse = {
    data: [{
        id: 'user-1',
        nickname: '끝말잇기',
        role: 'admin',
        contribution: 1200,
        month_contribution: 34,
    }],
    error: null,
};

interface QueryDouble {
    select(columns: string): QueryDouble;
    order(column: string, options: { ascending: boolean }): QueryDouble;
    then(
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
    ): Promise<unknown>;
}

const createQuery = (response: unknown, calls: string[], shouldThrow = false): QueryDouble => {
    const query: QueryDouble = {
        select: jest.fn((columns: string) => {
            calls.push(`select:${columns}`);
            return query;
        }),
        order: jest.fn((column: string, options: { ascending: boolean }) => {
            calls.push(`order:${column}:${options.ascending}`);
            return query;
        }),
        then: (resolve, reject) => (
            shouldThrow
                ? Promise.reject(new Error('private database detail')).then(resolve, reject)
                : Promise.resolve(response).then(resolve, reject)
        ),
    };
    return query;
};

const createGateway = (response: unknown = validResponse, shouldThrow = false) => {
    const calls: string[] = [];
    const query = createQuery(response, calls, shouldThrow);
    const from = jest.fn((table: string) => {
        calls.push(`from:${table}`);
        return query;
    });

    return {
        gateway: new SupabaseAdminUserListQueryGateway({ from } as never),
        calls,
    };
};

describe('SupabaseAdminUserListQueryGateway', () => {
    test.each([
        [{ field: 'contribution', direction: 'desc' }, 'contribution', false],
        [{ field: 'monthContribution', direction: 'asc' }, 'month_contribution', true],
        [{ field: 'nickname', direction: 'asc' }, 'nickname', true],
    ] as const)('selects the narrow columns and applies %s ordering', async (sort, column, ascending) => {
        // Break caught: selecting a generated row shape or mapping a camelCase sort to the wrong database column/direction.
        const { gateway, calls } = createGateway();

        await expect(gateway.loadList(sort)).resolves.toEqual(ok([{
            id: 'user-1',
            nickname: '끝말잇기',
            role: 'admin',
            contribution: 1200,
            monthContribution: 34,
        }]));
        expect(calls).toEqual([
            'from:users',
            `select:${selectColumns}`,
            `order:${column}:${ascending}`,
        ]);
    });

    test('normalizes missing, null, and unknown roles to guest while preserving known roles', async () => {
        // Break caught: exposing a nullable or unrecognized database role to the screen instead of the explicit role union.
        const { gateway } = createGateway({
            data: [
                { ...validResponse.data[0], role: undefined },
                { ...validResponse.data[0], id: 'user-2', role: null },
                { ...validResponse.data[0], id: 'user-3', role: 'owner' },
                { ...validResponse.data[0], id: 'user-4', role: 'r3' },
            ],
            error: null,
        });

        await expect(gateway.loadList({ field: 'nickname', direction: 'asc' })).resolves.toEqual(ok([
            { id: 'user-1', nickname: '끝말잇기', role: 'guest', contribution: 1200, monthContribution: 34 },
            { id: 'user-2', nickname: '끝말잇기', role: 'guest', contribution: 1200, monthContribution: 34 },
            { id: 'user-3', nickname: '끝말잇기', role: 'guest', contribution: 1200, monthContribution: 34 },
            { id: 'user-4', nickname: '끝말잇기', role: 'r3', contribution: 1200, monthContribution: 34 },
        ]));
    });

    test.each([
        [{ ...validResponse.data[0], id: '' }],
        [{ ...validResponse.data[0], nickname: null }],
        [{ ...validResponse.data[0], contribution: '1200' }],
        [{ ...validResponse.data[0], month_contribution: Number.NaN }],
        { data: 'not-an-array', error: null },
    ])('maps malformed Supabase data to a stable public error', async (data) => {
        // Break caught: accepting malformed identifier, display, or numeric database values in the projection.
        const response = Array.isArray(data) ? { data, error: null } : data;
        const { gateway } = createGateway(response);

        await expect(gateway.loadList({ field: 'contribution', direction: 'desc' })).resolves.toEqual(stableError);
    });

    test.each([
        ['a whitespace-only identifier', { ...validResponse.data[0], id: '   ' }],
        ['a whitespace-only nickname', { ...validResponse.data[0], nickname: '\t' }],
    ])('maps %s to a stable public error', async (_description, row) => {
        // Break caught: allowing visually blank IDs or nicknames to reach profile navigation and screen rendering.
        const { gateway } = createGateway({ data: [row], error: null });

        await expect(gateway.loadList({ field: 'contribution', direction: 'desc' })).resolves.toEqual(stableError);
    });

    test('maps a returned Supabase error to a stable public error', async () => {
        // Break caught: leaking a returned PostgREST diagnostic beyond Infrastructure.
        const { gateway } = createGateway({ data: null, error: { message: 'private policy detail' } });

        await expect(gateway.loadList({ field: 'contribution', direction: 'desc' })).resolves.toEqual(stableError);
    });

    test('maps a thrown Supabase query failure to a stable public error', async () => {
        // Break caught: allowing a rejected SDK query promise to escape this adapter.
        const { gateway } = createGateway(validResponse, true);

        await expect(gateway.loadList({ field: 'contribution', direction: 'desc' })).resolves.toEqual(stableError);
    });
});
