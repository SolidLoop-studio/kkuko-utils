import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseDocsLogQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-log-query-gateway';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

type QueryResult = QueryResponse | Error;

class FakeDocsLogQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly calls: string[],
    ) {}

    select(columns: string): this {
        this.calls.push(`select:${columns}`);
        return this;
    }

    eq(column: string, value: number): this {
        this.calls.push(`eq:${column}:${value}`);
        return this;
    }

    maybeSingle(): this {
        this.calls.push('maybeSingle');
        return this;
    }

    order(column: string, options: { ascending: boolean }): this {
        this.calls.push(`order:${column}:${options.ascending}`);
        return this;
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error
            ? Promise.reject(this.result)
            : Promise.resolve(this.result)
        ).then(onfulfilled, onrejected);
    }
}

const createClient = ({
    docsResult,
    logsResult,
}: {
    docsResult: QueryResult;
    logsResult: QueryResult;
}) => {
    const calls: string[] = [];
    const docsQuery = new FakeDocsLogQuery(docsResult, calls);
    const logsQuery = new FakeDocsLogQuery(logsResult, calls);
    const client = {
        from: jest.fn((table: 'docs' | 'docs_logs') => {
            calls.push(`from:${table}`);
            return table === 'docs' ? docsQuery : logsQuery;
        }),
    };

    return { client, calls };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 로그를 불러오는 중 오류가 발생했습니다.',
};

const docsResponse = {
    data: { id: 41, name: '나' },
    error: null,
};

describe('SupabaseDocsLogQueryGateway', () => {
    it('reads docs metadata before logs and maps the logs projection in descending date order', async () => {
        const { client, calls } = createClient({
            docsResult: docsResponse,
            logsResult: {
                data: [{
                    id: 9,
                    word: '나라',
                    date: '2026-08-25T02:00:00.000Z',
                    type: 'add',
                    users: null,
                }],
                error: null,
            },
        });

        await expect(new SupabaseDocsLogQueryGateway(client).loadByDocsId(41)).resolves.toEqual(ok({
            docsId: 41,
            docsName: '나',
            entries: [{
                id: 9,
                word: '나라',
                userNickname: null,
                occurredAt: '2026-08-25T02:00:00.000Z',
                type: 'add',
            }],
        }));
        expect(calls).toEqual([
            'from:docs',
            'select:id, name',
            'eq:id:41',
            'maybeSingle',
            'from:docs_logs',
            'select:id, word, date, type, users(nickname)',
            'eq:docs_id:41',
            'order:date:false',
        ]);
    });

    it('returns null without querying logs when the docs metadata is missing', async () => {
        const { client, calls } = createClient({
            docsResult: { data: null, error: null },
            logsResult: { data: [], error: null },
        });

        await expect(new SupabaseDocsLogQueryGateway(client).loadByDocsId(41)).resolves.toEqual(ok(null));
        expect(calls).toEqual([
            'from:docs',
            'select:id, name',
            'eq:id:41',
            'maybeSingle',
        ]);
    });

    it('maps a delete log and a nullable joined user nickname', async () => {
        const { client } = createClient({
            docsResult: docsResponse,
            logsResult: {
                data: [{
                    id: 10,
                    word: '나무',
                    date: '2026-08-25T03:00:00.000Z',
                    type: 'delete',
                    users: { nickname: null },
                }],
                error: null,
            },
        });

        await expect(new SupabaseDocsLogQueryGateway(client).loadByDocsId(41)).resolves.toEqual(ok({
            docsId: 41,
            docsName: '나',
            entries: [{
                id: 10,
                word: '나무',
                userNickname: null,
                occurredAt: '2026-08-25T03:00:00.000Z',
                type: 'delete',
            }],
        }));
    });

    it.each([
        ['malformed docs metadata', { data: { id: '41', name: '나' }, error: null }, { data: [], error: null }],
        ['malformed log row', docsResponse, { data: [{ id: 9 }], error: null }],
        ['docs query error', { data: null, error: { message: 'private docs detail' } }, { data: [], error: null }],
        ['logs query error', docsResponse, { data: null, error: { message: 'private logs detail' } }],
        ['thrown docs query', new Error('private docs connection detail'), { data: [], error: null }],
        ['thrown logs query', docsResponse, new Error('private logs connection detail')],
    ] as const)('returns a stable infrastructure error for %s', async (_description, docsResult, logsResult) => {
        const { client } = createClient({ docsResult, logsResult });

        await expect(new SupabaseDocsLogQueryGateway(client).loadByDocsId(41))
            .resolves.toEqual(err(infrastructureError));
    });
});
