jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseWordLogQueryGateway } from '@/src/modules/word-logs/infrastructure/browser/supabase-word-log-query-gateway';
import type { WordLogPageQuery } from '@/src/modules/word-logs/application/word-log-query-types';
import { err, ok } from '@/src/shared/application/result';

const query: WordLogPageQuery = {
    page: 2,
    pageSize: 30,
    state: 'approved',
    requestType: 'add',
};

const success = {
    data: [{
        id: 31,
        created_at: '2026-08-29T00:00:00.000Z',
        word: '가나',
        make_by: 'requester-1',
        processed_by: null,
        state: 'approved',
        r_type: 'add',
        make_by_user: { nickname: '신청자' },
        processed_by_user: null,
    }],
    count: 61,
    error: null,
};

interface QueryDouble {
    select(columns: string, options: { count: 'exact' }): QueryDouble;
    order(column: string, options: { ascending: boolean }): QueryDouble;
    eq(column: string, value: string): QueryDouble;
    range(from: number, to: number): QueryDouble;
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown): Promise<unknown>;
}

const createGateway = (response: unknown = success, shouldThrow = false) => {
    const calls: string[] = [];
    const request: QueryDouble = {
        select: jest.fn((columns, options) => {
            calls.push(`select:${columns}:count=${options.count}`);
            return request;
        }),
        order: jest.fn((column, options) => {
            calls.push(`order:${column}:${options.ascending}`);
            return request;
        }),
        eq: jest.fn((column, value) => {
            calls.push(`eq:${column}:${value}`);
            return request;
        }),
        range: jest.fn((from, to) => {
            calls.push(`range:${from}:${to}`);
            return request;
        }),
        then: (resolve, reject) => (
            shouldThrow
                ? Promise.reject(new Error('private Supabase detail')).then(resolve, reject)
                : Promise.resolve(response).then(resolve, reject)
        ),
    };
    const from = jest.fn((table: string) => {
        calls.push(`from:${table}`);
        return request;
    });
    return {
        gateway: new SupabaseWordLogQueryGateway({ from } as never),
        calls,
    };
};

describe('SupabaseWordLogQueryGateway', () => {
    test('loads a filtered page with exact count, newest-first order, inclusive range, and camelCase rows', async () => {
        // Break caught: omitting a visible filter/count/order/range or leaking database column names.
        const { gateway, calls } = createGateway();

        await expect(gateway.loadPage(query)).resolves.toEqual(ok({
            items: [{
                id: 31,
                createdAt: '2026-08-29T00:00:00.000Z',
                word: '가나',
                requesterId: 'requester-1',
                processorId: null,
                state: 'approved',
                requestType: 'add',
                requesterNickname: '신청자',
                processorNickname: null,
            }],
            totalCount: 61,
            page: 2,
            pageSize: 30,
        }));
        expect(calls).toEqual([
            'from:logs',
            'select:id, created_at, word, make_by, processed_by, state, r_type, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname):count=exact',
            'order:created_at:false',
            'order:id:false',
            'eq:state:approved',
            'eq:r_type:add',
            'range:30:59',
        ]);
    });

    test('loads an empty unfiltered first page with an exact zero count', async () => {
        // Break caught: treating a valid empty query as failure or accidentally adding all-value predicates.
        const { gateway, calls } = createGateway({ data: [], count: 0, error: null });

        await expect(gateway.loadPage({
            page: 1,
            pageSize: 30,
            state: 'all',
            requestType: 'all',
        })).resolves.toEqual(ok({
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 30,
        }));
        expect(calls).not.toContainEqual(expect.stringMatching(/^eq:/));
    });

    test.each([
        ['a malformed row', { ...success, data: [{ ...success.data[0], make_by_user: [] }] }],
        ['an unknown enum', { ...success, data: [{ ...success.data[0], state: 'private-state' }] }],
        ['a missing exact count', { ...success, count: null }],
        ['a returned database error', { data: null, count: null, error: { message: 'private PostgREST detail' } }],
    ])('maps %s to one stable public error', async (_description, response) => {
        // Break caught: accepting unknown database data or exposing PostgREST response details.
        const { gateway } = createGateway(response);

        await expect(gateway.loadPage(query)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그를 불러오는 중 오류가 발생했습니다.',
        }));
    });

    test('maps a thrown query failure to one stable public error', async () => {
        // Break caught: allowing a rejected browser query promise to escape Infrastructure.
        const { gateway } = createGateway(success, true);

        await expect(gateway.loadPage(query)).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '로그를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
