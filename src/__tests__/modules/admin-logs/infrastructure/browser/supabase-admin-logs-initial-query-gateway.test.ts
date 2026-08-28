jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseAdminLogsInitialQueryGateway } from '@/src/modules/admin-logs/infrastructure/browser/supabase-admin-logs-initial-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

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
        error: null,
    },
    docs_logs: {
        data: [{
            id: 21,
            word: '다라',
            type: 'delete',
            date: '2026-08-28T00:00:00.000Z',
            docs: null,
            users: { nickname: null },
        }],
        error: null,
    },
    docs: {
        data: [{ id: 31, name: '주제 문서', typez: 'theme' }],
        error: null,
    },
};

interface QueryDouble {
    select(columns: string): QueryDouble;
    order(column: string, options: { ascending: boolean }): QueryDouble;
    range(from: number, to: number): QueryDouble;
    eq(column: string, value: boolean): QueryDouble;
    then(
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
    ): Promise<unknown>;
}

const createQuery = (response: unknown, calls: string[]) => {
    const query: QueryDouble = {
        select: jest.fn((columns: string) => {
            calls.push(`select:${columns}`);
            return query;
        }),
        order: jest.fn((column: string, options: { ascending: boolean }) => {
            calls.push(`order:${column}:${options.ascending}`);
            return query;
        }),
        range: jest.fn((from: number, to: number) => {
            calls.push(`range:${from}:${to}`);
            return query;
        }),
        eq: jest.fn((column: string, value: boolean) => {
            calls.push(`eq:${column}:${value}`);
            return query;
        }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
            Promise.resolve(response).then(resolve, reject)
        ),
    };
    return query;
};

const createGateway = (
    responses: Record<string, unknown> = successfulResponses,
    isProduction = false,
) => {
    const calls: string[] = [];
    const queries = {
        logs: createQuery(responses.logs, calls),
        docs_logs: createQuery(responses.docs_logs, calls),
        docs: createQuery(responses.docs, calls),
    };
    const from = jest.fn((table: keyof typeof queries) => {
        calls.push(`from:${table}`);
        return queries[table];
    });

    return {
        gateway: new SupabaseAdminLogsInitialQueryGateway({ from } as never, isProduction),
        calls,
    };
};

describe('SupabaseAdminLogsInitialQueryGateway', () => {
    test('loads newest-first initial ranges and maps nullable relations to a narrow camelCase projection', async () => {
        // Break caught: changing initial ordering/ranges, leaking row names, or dereferencing a nullable relation.
        const { gateway, calls } = createGateway();

        await expect(gateway.loadInitial()).resolves.toEqual(ok({
            wordLogs: [{
                id: 11,
                word: '가나',
                state: 'approved',
                requestType: 'add',
                requesterNickname: '신청자',
                processorNickname: null,
                createdAt: '2026-08-29T00:00:00.000Z',
            }],
            docsLogs: [{
                id: 21,
                word: '다라',
                documentName: null,
                actorNickname: null,
                type: 'delete',
                occurredAt: '2026-08-28T00:00:00.000Z',
            }],
            documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
        }));
        expect(calls).toEqual([
            'from:logs',
            'select:id, word, state, r_type, created_at, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)',
            'order:created_at:false',
            'range:0:999',
            'from:docs_logs',
            'select:id, word, type, date, docs(name), users(nickname)',
            'order:date:false',
            'range:0:999',
            'from:docs',
            'select:id, name, typez',
        ]);
    });

    test('keeps hidden document choices out of the production query', async () => {
        // Break caught: widening the production filter choices beyond the legacy allDocs behavior.
        const { gateway, calls } = createGateway(successfulResponses, true);

        await gateway.loadInitial();

        expect(calls).toContain('eq:is_hidden:false');
    });

    test.each([
        ['a returned word-log query error', { ...successfulResponses, logs: { data: null, error: { message: 'private detail' } } }],
        ['a returned docs-log query error', { ...successfulResponses, docs_logs: { data: null, error: { message: 'private detail' } } }],
        ['a returned document-choice query error', { ...successfulResponses, docs: { data: null, error: { message: 'private detail' } } }],
        ['a malformed word-log row', { ...successfulResponses, logs: { data: [{ ...successfulResponses.logs.data[0], state: 'unknown' }], error: null } }],
        ['a malformed docs-log relation', { ...successfulResponses, docs_logs: { data: [{ ...successfulResponses.docs_logs.data[0], docs: [] }], error: null } }],
        ['a malformed document choice', { ...successfulResponses, docs: { data: [{ id: 31, name: '주제 문서', typez: 'unknown' }], error: null } }],
    ])('maps %s to one stable public error', async (_description, responses) => {
        // Break caught: accepting malformed database rows or exposing PostgREST diagnostics.
        const { gateway } = createGateway(responses);

        await expect(gateway.loadInitial()).resolves.toEqual(stableError);
    });
});
