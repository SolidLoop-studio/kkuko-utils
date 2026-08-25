import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SupabaseDocsInfoQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-info-query-gateway';

type QueryResponse = {
    data?: unknown;
    count?: unknown;
    error: unknown;
};

type QueryResult = QueryResponse | Error;

class FakeDocsInfoQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly calls: string[],
    ) {}

    select(columns: string, options?: { count?: 'exact'; head?: boolean }): this {
        this.calls.push(`select:${columns}:${JSON.stringify(options ?? null)}`);
        return this;
    }

    eq(column: string, value: boolean | number | string): this {
        this.calls.push(`eq:${column}:${value}`);
        return this;
    }

    in(column: string, values: string[]): this {
        this.calls.push(`in:${column}:${values.join(',')}`);
        return this;
    }

    gt(column: string, value: number): this {
        this.calls.push(`gt:${column}:${value}`);
        return this;
    }

    maybeSingle(): this {
        this.calls.push('maybeSingle');
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

const docsRow = (overrides: Record<string, unknown> = {}) => ({
    id: 51,
    created_at: '2026-08-01T00:00:00.000Z',
    name: '다',
    users: { nickname: '제작자' },
    typez: 'letter',
    last_update: '2026-08-25T03:00:00.000Z',
    views: 120,
    duem: false,
    ...overrides,
});

const createClient = ({
    docsResult = { data: docsRow(), error: null },
    starsResult = { data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], error: null },
    letterCountResult = { data: { count: 32 }, error: null },
    themeResult = { data: { id: 8, name: '다' }, error: null },
    themeCountResult = { count: 32, error: null },
    ectCountResult = { count: 32, error: null },
    rankResult = { data: 2, error: null },
}: {
    docsResult?: QueryResult;
    starsResult?: QueryResult;
    letterCountResult?: QueryResult;
    themeResult?: QueryResult;
    themeCountResult?: QueryResult;
    ectCountResult?: QueryResult;
    rankResult?: QueryResult;
} = {}) => {
    const calls: string[] = [];
    const queries = {
        docs: new FakeDocsInfoQuery(docsResult, calls),
        user_star_docs: new FakeDocsInfoQuery(starsResult, calls),
        word_last_letter_counts: new FakeDocsInfoQuery(letterCountResult, calls),
        themes: new FakeDocsInfoQuery(themeResult, calls),
        word_themes: new FakeDocsInfoQuery(themeCountResult, calls),
        words: new FakeDocsInfoQuery(ectCountResult, calls),
    };
    const client = {
        from: jest.fn((table: keyof typeof queries) => {
            calls.push(`from:${table}`);
            return queries[table];
        }),
        rpc: jest.fn((_functionName: 'get_doc_rank', _parameters: { doc_id: number }) => {
            calls.push(`rpc:${_functionName}:${_parameters.doc_id}`);
            return new FakeDocsInfoQuery(rankResult, calls);
        }),
    };

    return { client, calls };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 정보를 불러오는 중 오류가 발생했습니다.',
};

describe('SupabaseDocsInfoQueryGateway', () => {
    it('maps the letter docs info projection with its metadata and aggregate counts', async () => {
        const { client, calls } = createClient();

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(ok({
            metadata: {
                id: 51,
                createdAt: '2026-08-01T00:00:00.000Z',
                name: '다',
                makerNickname: '제작자',
                type: 'letter',
                lastUpdatedAt: '2026-08-25T03:00:00.000Z',
                views: 120,
            },
            wordCount: 32,
            starCount: 4,
            viewRank: 2,
        }));
        expect(calls).toContain('from:docs');
        expect(calls).toContain('from:user_star_docs');
        expect(calls).toContain('from:word_last_letter_counts');
        expect(calls).toContain('rpc:get_doc_rank:51');
    });

    it('uses the twoeum last-letter count query for a letter docs', async () => {
        const { client, calls } = createClient({
            docsResult: { data: docsRow({ name: '녀', duem: true }), error: null },
            letterCountResult: { data: [{ count: 11 }, { count: 21 }], error: null },
        });

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(ok(expect.objectContaining({
            wordCount: 32,
        })));
        expect(calls.some((call) => call.startsWith('in:last_letter:'))).toBe(true);
    });

    it('looks up a theme before counting its words', async () => {
        const { client, calls } = createClient({
            docsResult: { data: docsRow({ typez: 'theme', name: '동물' }), error: null },
            themeResult: { data: { id: 8, name: '동물' }, error: null },
            themeCountResult: { count: 17, error: null },
        });

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(ok(expect.objectContaining({
            metadata: expect.objectContaining({ type: 'theme', name: '동물' }),
            wordCount: 17,
        })));
        expect(calls).toContain('from:themes');
        expect(calls).toContain('eq:name:동물');
        expect(calls).toContain('from:word_themes');
        expect(calls).toContain('eq:theme_id:8');
    });

    it.each([201, 202])('counts the supported ect docs id %s with the compatibility query', async (id) => {
        const { client, calls } = createClient({
            docsResult: { data: docsRow({ id, typez: 'ect', name: '특수' }), error: null },
            ectCountResult: { count: 44, error: null },
        });

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(expect.objectContaining({
            metadata: expect.objectContaining({ id, type: 'ect' }),
            wordCount: 44,
        })));
        expect(calls).toContain('from:words');
        expect(calls).toContain('eq:k_canuse:true');
        expect(calls).toContain('gt:length:8');
    });

    it('returns null for an unsupported ect docs id without count or rank queries', async () => {
        const { client, calls } = createClient({
            docsResult: { data: docsRow({ id: 203, typez: 'ect' }), error: null },
        });

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(203)).resolves.toEqual(ok(null));
        expect(calls).not.toContain('from:words');
        expect(calls).not.toContain('rpc:get_doc_rank:203');
    });

    it('keeps a null maker and maps null counts to -1', async () => {
        const { client } = createClient({
            docsResult: { data: docsRow({ users: null, typez: 'theme' }), error: null },
            themeCountResult: { count: null, error: null },
        });

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(ok(expect.objectContaining({
            metadata: expect.objectContaining({ makerNickname: null }),
            wordCount: -1,
        })));
    });

    it.each([
        ['malformed docs metadata', { docsResult: { data: docsRow({ views: '120' }), error: null } }],
        ['malformed maker relation', { docsResult: { data: docsRow({ users: { nickname: 1 } }), error: null } }],
        ['malformed letter count row', { letterCountResult: { data: { count: '32' }, error: null } }],
        ['malformed theme lookup row', {
            docsResult: { data: docsRow({ typez: 'theme' }), error: null },
            themeResult: { data: { id: '8', name: '다' }, error: null },
        }],
        ['malformed rank response', { rankResult: { data: '2', error: null } }],
    ])('returns a stable infrastructure error for %s', async (_description, responses) => {
        const { client } = createClient(responses);

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(err(infrastructureError));
    });

    it.each([
        ['docs query error', { docsResult: { data: null, error: { message: 'private docs error' } } }],
        ['stars query error', { starsResult: { data: null, error: { message: 'private stars error' } } }],
        ['letter count query error', { letterCountResult: { data: null, error: { message: 'private count error' } } }],
        ['theme lookup query error', {
            docsResult: { data: docsRow({ typez: 'theme' }), error: null },
            themeResult: { data: null, error: { message: 'private theme error' } },
        }],
        ['theme count query error', {
            docsResult: { data: docsRow({ typez: 'theme' }), error: null },
            themeCountResult: { count: null, error: { message: 'private theme count error' } },
        }],
        ['ect count query error', {
            docsResult: { data: docsRow({ id: 201, typez: 'ect' }), error: null },
            ectCountResult: { count: null, error: { message: 'private ect count error' } },
        }],
        ['rank query error', { rankResult: { data: null, error: { message: 'private rank error' } } }],
    ])('returns a stable infrastructure error for every %s', async (_description, responses) => {
        const { client } = createClient(responses);

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(err(infrastructureError));
    });

    it.each([
        ['thrown docs query', { docsResult: new Error('private docs connection detail') }],
        ['thrown stars query', { starsResult: new Error('private stars connection detail') }],
        ['thrown count query', { letterCountResult: new Error('private count connection detail') }],
        ['thrown rank query', { rankResult: new Error('private rank connection detail') }],
    ])('returns a stable infrastructure error for %s', async (_description, responses) => {
        const { client } = createClient(responses);

        await expect(new SupabaseDocsInfoQueryGateway(client).loadByDocsId(51)).resolves.toEqual(err(infrastructureError));
    });
});
