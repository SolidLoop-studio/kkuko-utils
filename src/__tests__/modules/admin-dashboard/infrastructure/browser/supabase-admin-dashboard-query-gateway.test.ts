jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseAdminDashboardQueryGateway } from '@/src/modules/admin-dashboard/infrastructure/browser/supabase-admin-dashboard-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = {
    kind: 'infrastructure' as const,
    message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
};

type TableName = 'words_count' | 'wait_words' | 'word_themes_wait';

interface Responses {
    words_count: unknown;
    wait_words: unknown;
    word_themes_wait: unknown;
}

const successResponses: Responses = {
    words_count: { data: { total_words: 123_456 }, error: null },
    wait_words: { data: null, count: 11, error: null },
    word_themes_wait: { data: null, count: 6, error: null },
};

const createGateway = (
    responses: Responses = successResponses,
    thrownTable?: TableName,
) => {
    const calls: string[] = [];
    const from = jest.fn((table: TableName) => ({
        select: jest.fn((columns: string, options?: { count: 'exact'; head: true }) => {
            calls.push(`select:${table}:${columns}:${options === undefined
                ? 'row'
                : `count=${options.count}:head=${options.head}`}`);
            const response = thrownTable === table
                ? Promise.reject(new Error('private Supabase detail'))
                : Promise.resolve(responses[table]);
            return table === 'words_count'
                ? {
                    single: jest.fn(() => {
                        calls.push('single:words_count');
                        return response;
                    }),
                }
                : response;
        }),
    }));

    return {
        gateway: new SupabaseAdminDashboardQueryGateway({ from } as never),
        calls,
    };
};

describe('SupabaseAdminDashboardQueryGateway', () => {
    test.each([
        [
            {
                words_count: { data: { total_words: 0 }, error: null },
                wait_words: { data: null, count: 0, error: null },
                word_themes_wait: { data: null, count: 0, error: null },
            },
            { totalWords: 0, pendingWordChanges: 0 },
        ],
        [successResponses, { totalWords: 123_456, pendingWordChanges: 17 }],
    ])('maps the single summary row and two exact head counts for %#', async (responses, expected) => {
        // Break caught: reading the wrong table/column, defaulting zero, or leaking snake_case fields.
        const { gateway, calls } = createGateway(responses);

        await expect(gateway.loadSummary()).resolves.toEqual(ok(expected));
        expect(calls).toEqual([
            'select:words_count:total_words:row',
            'single:words_count',
            'select:wait_words:word:count=exact:head=true',
            'select:word_themes_wait:word_id:count=exact:head=true',
        ]);
    });

    test('starts all three database reads before waiting for any result', async () => {
        // Break caught: sequential awaits that make dashboard latency the sum of all three reads.
        const calls: string[] = [];
        const resolvers = new Map<TableName, (value: unknown) => void>();
        const requests = new Map<TableName, Promise<unknown>>();
        for (const table of ['words_count', 'wait_words', 'word_themes_wait'] as const) {
            requests.set(table, new Promise((resolve) => resolvers.set(table, resolve)));
        }
        const from = jest.fn((table: TableName) => ({
            select: jest.fn(() => {
                calls.push(`select:${table}`);
                return table === 'words_count'
                    ? { single: () => requests.get(table) }
                    : requests.get(table);
            }),
        }));
        const gateway = new SupabaseAdminDashboardQueryGateway({ from } as never);

        const resultPromise = gateway.loadSummary();
        await Promise.resolve();

        expect(calls).toEqual([
            'select:words_count',
            'select:wait_words',
            'select:word_themes_wait',
        ]);

        resolvers.get('words_count')?.({ data: { total_words: 9 }, error: null });
        resolvers.get('wait_words')?.({ data: null, count: 2, error: null });
        resolvers.get('word_themes_wait')?.({ data: null, count: 3, error: null });
        await expect(resultPromise).resolves.toEqual(ok({
            totalWords: 9,
            pendingWordChanges: 5,
        }));
    });

    test.each([
        ['a missing summary row', {
            ...successResponses,
            words_count: { data: null, error: null },
        }],
        ['a missing total_words value', {
            ...successResponses,
            words_count: { data: {}, error: null },
        }],
        ['a null total_words value', {
            ...successResponses,
            words_count: { data: { total_words: null }, error: null },
        }],
        ['a negative total_words value', {
            ...successResponses,
            words_count: { data: { total_words: -1 }, error: null },
        }],
        ['a fractional total_words value', {
            ...successResponses,
            words_count: { data: { total_words: 1.5 }, error: null },
        }],
        ['an unsafe total_words value', {
            ...successResponses,
            words_count: { data: { total_words: Number.MAX_SAFE_INTEGER + 1 }, error: null },
        }],
        ['a null exact count', {
            ...successResponses,
            wait_words: { data: null, count: null, error: null },
        }],
        ['a negative exact count', {
            ...successResponses,
            wait_words: { data: null, count: -1, error: null },
        }],
        ['a fractional exact count', {
            ...successResponses,
            word_themes_wait: { data: null, count: 1.5, error: null },
        }],
        ['an unsafe exact count', {
            ...successResponses,
            word_themes_wait: {
                data: null,
                count: Number.MAX_SAFE_INTEGER + 1,
                error: null,
            },
        }],
        ['an unsafe pending count sum', {
            ...successResponses,
            wait_words: { data: null, count: Number.MAX_SAFE_INTEGER, error: null },
            word_themes_wait: { data: null, count: 1, error: null },
        }],
        ['a returned summary error', {
            ...successResponses,
            words_count: {
                data: null,
                error: { message: 'private words_count detail' },
            },
        }],
        ['a returned pending-count error', {
            ...successResponses,
            word_themes_wait: {
                data: null,
                count: null,
                error: { message: 'private count detail' },
            },
        }],
    ])('maps %s to one stable public error', async (_description, responses) => {
        // Break caught: trusting malformed counts or exposing returned PostgREST diagnostics.
        const { gateway } = createGateway(responses);

        await expect(gateway.loadSummary()).resolves.toEqual(err(stableError));
    });

    test('maps a thrown query failure to one stable public error', async () => {
        // Break caught: allowing one rejected concurrent request to escape Infrastructure.
        const { gateway } = createGateway(successResponses, 'wait_words');

        await expect(gateway.loadSummary()).resolves.toEqual(err(stableError));
    });
});
