jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseAdminLogsPageQueryGateway } from '@/src/modules/admin-logs/infrastructure/browser/supabase-admin-logs-page-query-gateway';
import type { AdminLogsPageQuery } from '@/src/modules/admin-logs/application/admin-logs-page-query-types';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const wordQuery: AdminLogsPageQuery = {
    page: 2,
    pageSize: 30,
    fromDate: '2026-08-01T00:00:00.000Z',
    toDate: '2026-08-31T23:59:59.999Z',
    filter: { kind: 'word', state: 'approved', requestType: 'add' },
};

const docsQuery: AdminLogsPageQuery = {
    page: 1,
    pageSize: 150,
    fromDate: '2026-08-01T00:00:00.000Z',
    toDate: '2026-08-31T23:59:59.999Z',
    filter: { kind: 'docs', documentName: '주제 문서', type: 'delete' },
};

const successfulResponses = {
    logs: {
        data: [{
            id: 11,
            word: '가나',
            state: 'approved',
            r_type: 'add',
            created_at: '2026-08-29T00:00:00.000Z',
            make_by_user: { nickname: '신청자' },
            processed_by_user: null,
        }],
        count: 31,
        error: null,
    },
    docs_logs: {
        data: [{
            id: 21,
            word: '다라',
            type: 'delete',
            date: '2026-08-28T00:00:00.000Z',
            docs: { name: '주제 문서' },
            users: { nickname: null },
        }],
        count: 1,
        error: null,
    },
};

interface QueryDouble {
    select(columns: string, options: { count: 'exact' }): QueryDouble;
    order(column: string, options: { ascending: boolean }): QueryDouble;
    eq(column: string, value: string): QueryDouble;
    gte(column: string, value: string): QueryDouble;
    lte(column: string, value: string): QueryDouble;
    range(from: number, to: number): QueryDouble;
    then(
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
    ): Promise<unknown>;
}

const createQuery = (response: unknown, calls: string[], shouldThrow = false): QueryDouble => {
    const query: QueryDouble = {
        select: jest.fn((columns: string, options: { count: 'exact' }) => {
            calls.push(`select:${columns}:count=${options.count}`);
            return query;
        }),
        order: jest.fn((column: string, options: { ascending: boolean }) => {
            calls.push(`order:${column}:${options.ascending}`);
            return query;
        }),
        eq: jest.fn((column: string, value: string) => {
            calls.push(`eq:${column}:${value}`);
            return query;
        }),
        gte: jest.fn((column: string, value: string) => {
            calls.push(`gte:${column}:${value}`);
            return query;
        }),
        lte: jest.fn((column: string, value: string) => {
            calls.push(`lte:${column}:${value}`);
            return query;
        }),
        range: jest.fn((from: number, to: number) => {
            calls.push(`range:${from}:${to}`);
            return query;
        }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
            shouldThrow
                ? Promise.reject(new Error('private database detail')).then(resolve, reject)
                : Promise.resolve(response).then(resolve, reject)
        ),
    };
    return query;
};

const createGateway = (
    responses: Record<string, unknown> = successfulResponses,
    shouldThrow = false,
) => {
    const calls: string[] = [];
    const queries = {
        logs: createQuery(responses.logs, calls, shouldThrow),
        docs_logs: createQuery(responses.docs_logs, calls, shouldThrow),
    };
    const from = jest.fn((table: keyof typeof queries) => {
        calls.push(`from:${table}`);
        return queries[table];
    });

    return {
        gateway: new SupabaseAdminLogsPageQueryGateway({ from } as never),
        calls,
    };
};

describe('SupabaseAdminLogsPageQueryGateway', () => {
    test('loads a filtered word-log page with an exact count, inclusive dates, newest-first order, and mapped rows', async () => {
        // Break caught: a page query that omits a filter, count, date bound, ordering, or returns database row names.
        const { gateway, calls } = createGateway();

        await expect(gateway.loadPage(wordQuery)).resolves.toEqual(ok({
            kind: 'word',
            items: [{
                id: 11,
                word: '가나',
                state: 'approved',
                requestType: 'add',
                requesterNickname: '신청자',
                processorNickname: null,
                createdAt: '2026-08-29T00:00:00.000Z',
            }],
            totalCount: 31,
            page: 2,
            pageSize: 30,
        }));
        expect(calls).toEqual([
            'from:logs',
            'select:id, word, state, r_type, created_at, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname):count=exact',
            'order:created_at:false',
            'order:id:false',
            'eq:state:approved',
            'eq:r_type:add',
            'gte:created_at:2026-08-01T00:00:00.000Z',
            'lte:created_at:2026-08-31T23:59:59.999Z',
            'range:30:59',
        ]);
    });

    test('loads a docs-log page with an inner document-name filter and maps its row', async () => {
        // Break caught: filtering a nullable joined document without an inner join or leaking docs_log row names.
        const { gateway, calls } = createGateway();

        await expect(gateway.loadPage(docsQuery)).resolves.toEqual(ok({
            kind: 'docs',
            items: [{
                id: 21,
                word: '다라',
                documentName: '주제 문서',
                actorNickname: null,
                type: 'delete',
                occurredAt: '2026-08-28T00:00:00.000Z',
            }],
            totalCount: 1,
            page: 1,
            pageSize: 150,
        }));
        expect(calls).toEqual([
            'from:docs_logs',
            'select:id, word, type, date, docs!inner(name), users(nickname):count=exact',
            'order:date:false',
            'order:id:false',
            'eq:docs.name:주제 문서',
            'eq:type:delete',
            'gte:date:2026-08-01T00:00:00.000Z',
            'lte:date:2026-08-31T23:59:59.999Z',
            'range:0:149',
        ]);
    });

    test('returns an empty page when the exact count is zero', async () => {
        // Break caught: treating a valid empty result as a malformed response or losing page metadata.
        const { gateway } = createGateway({
            ...successfulResponses,
            logs: { data: [], count: 0, error: null },
        });

        await expect(gateway.loadPage({
            ...wordQuery,
            page: 1,
            filter: { kind: 'word', state: 'all', requestType: 'all' },
        })).resolves.toEqual(ok({
            kind: 'word',
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 30,
        }));
    });

    test.each([
        ['a malformed word-log row', wordQuery, { ...successfulResponses, logs: { ...successfulResponses.logs, data: [{ ...successfulResponses.logs.data[0], state: 'unknown' }] } }],
        ['a malformed docs-log relation', docsQuery, { ...successfulResponses, docs_logs: { ...successfulResponses.docs_logs, data: [{ ...successfulResponses.docs_logs.data[0], docs: [] }] } }],
        ['a non-numeric exact count', wordQuery, { ...successfulResponses, logs: { ...successfulResponses.logs, count: '31' } }],
        ['a returned query error', wordQuery, { ...successfulResponses, logs: { data: null, count: null, error: { message: 'private database detail' } } }],
    ])('maps %s to one stable public error', async (_description, query, responses) => {
        // Break caught: accepting malformed rows/counts or exposing PostgREST diagnostics.
        const { gateway } = createGateway(responses);

        await expect(gateway.loadPage(query)).resolves.toEqual(stableError);
    });

    test('maps a thrown query failure to one stable public error', async () => {
        // Break caught: allowing a rejected browser query promise to escape the feature boundary.
        const { gateway } = createGateway(successfulResponses, true);

        await expect(gateway.loadPage(wordQuery)).resolves.toEqual(stableError);
    });
});
