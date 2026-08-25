import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SupabaseDocsContentQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway';

type QueryResponse = { data: unknown; error: unknown };
type QueryResult = QueryResponse | Error;

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(private readonly result: QueryResult, private readonly calls: string[]) {}

    select(columns: string): this { this.calls.push(`select:${columns}`); return this; }
    eq(column: string, value: boolean | number | string): this { this.calls.push(`eq:${column}:${value}`); return this; }
    in(column: string, values: string[]): this { this.calls.push(`in:${column}:${values.join(',')}`); return this; }
    ilike(column: string, value: string): this { this.calls.push(`ilike:${column}:${value}`); return this; }
    neq(column: string, value: number): this { this.calls.push(`neq:${column}:${value}`); return this; }
    gt(column: string, value: number): this { this.calls.push(`gt:${column}:${value}`); return this; }
    maybeSingle(): this { this.calls.push('maybeSingle'); return this; }
    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result))
            .then(onfulfilled, onrejected);
    }
}

const docsRow = (overrides: Record<string, unknown> = {}) => ({
    id: 61,
    name: '라',
    last_update: '2026-08-25T04:00:00.000Z',
    typez: 'letter',
    duem: false,
    ...overrides,
});

const createClient = (responses: Partial<Record<string, QueryResult>> = {}) => {
    const calls: string[] = [];
    const result = (name: string, fallback: QueryResponse): QueryResult => responses[name] ?? fallback;
    const queries = {
        docs: new FakeQuery(result('docs', { data: docsRow(), error: null }), calls),
        user_star_docs: new FakeQuery(result('stars', { data: [{ user_id: 'user-1' }], error: null }), calls),
        words: new FakeQuery(result('words', { data: [{ word: '라디오' }, { word: '라면' }], error: null }), calls),
        wait_words: new FakeQuery(result('waitWords', {
            data: [
                { word: '라디오', requested_by: '삭제요청자', request_type: 'delete' },
                { word: '라면', requested_by: '요청자', request_type: 'add' },
                { word: '라', requested_by: null, request_type: 'add' },
            ],
            error: null,
        }), calls),
        themes: new FakeQuery(result('themes', { data: { id: 8, name: '동물' }, error: null }), calls),
        word_themes_wait: new FakeQuery(result('themeWaitWords', { data: [], error: null }), calls),
        wait_word_themes: new FakeQuery(result('waitWordThemes', { data: [], error: null }), calls),
    };
    const client = {
        from: jest.fn((table: keyof typeof queries) => { calls.push(`from:${table}`); return queries[table]; }),
        rpc: jest.fn((name: string) => {
            calls.push(`rpc:${name}`);
            const key = name === 'get_words_by_theme' ? 'themeWords'
                : name === 'get_delete_requests_by_themeid' ? 'themeDeleteWords'
                    : name === 'get_long_wait_words_data' ? 'longWaitWords'
                        : name === 'get_mission_words' ? 'missionWords' : 'missionLen3Words';
            return new FakeQuery(result(key, { data: [], error: null }), calls);
        }),
    };
    return { client, calls };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 단어를 불러오는 중 오류가 발생했습니다.',
};

describe('SupabaseDocsContentQueryGateway', () => {
    it('maps a letter projection, removing pending deletes and one-character pending rows', async () => {
        const { client, calls } = createClient();

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(61)).resolves.toEqual(ok({
            metadata: { id: 61, title: '라', lastUpdatedAt: '2026-08-25T04:00:00.000Z', type: 'letter' },
            starredUserIds: ['user-1'],
            words: [
                { word: '라디오', status: 'delete', requesterNickname: '삭제요청자' },
                { word: '라면', status: 'add', requesterNickname: '요청자' },
            ],
            isSpecial: false,
        }));
        expect(calls).toContain('from:docs');
        expect(calls).toContain('from:user_star_docs');
        expect(calls).toContain('from:words');
        expect(calls).toContain('from:wait_words');
    });

    it('maps approved, add, and delete theme rows while giving a whole request priority', async () => {
        const { client } = createClient({
            docs: { data: docsRow({ id: 62, name: '동물', typez: 'theme' }), error: null },
            themeWords: { data: [{ word: '사자' }, { word: '호랑이' }], error: null },
            waitWordThemes: { data: [{ wait_words: { word: '기린', requested_by: null, request_type: 'add' } }], error: null },
            themeDeleteWords: { data: [{ word: '호랑이', requested_by: '삭제요청자', request_type: 'delete' }], error: null },
            themeWaitWords: { data: [{ words: { word: '사자' }, typez: 'add', req_by: '주제요청자' }], error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(62)).resolves.toEqual(ok(expect.objectContaining({
            words: [
                { word: '기린', status: 'add' },
                { word: '호랑이', status: 'delete', requesterNickname: '삭제요청자' },
                { word: '사자', status: 'add', requesterNickname: '주제요청자' },
            ],
        })));
    });

    it('maps ect content and preserves the special mission range flag', async () => {
        const { client, calls } = createClient({
            docs: { data: docsRow({ id: 209, name: '미션', typez: 'ect' }), error: null },
            missionWords: { data: [{ word: '가나다' }, { word: '가나가' }], error: null },
        });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(209)).resolves.toEqual(ok(expect.objectContaining({
            isSpecial: true,
            words: [{ word: '가나가', status: 'ok' }, { word: '가나다', status: 'ok' }],
        })));
        expect(calls).toContain('rpc:get_mission_words');
    });

    it.each([208, 223, 238])('returns marker docs id %s with no word query and no words', async (id) => {
        const { client, calls } = createClient({ docs: { data: docsRow({ id, typez: 'ect' }), error: null } });

        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(id)).resolves.toEqual(ok(expect.objectContaining({
            words: [],
            isSpecial: false,
        })));
        expect(calls).not.toContain('from:words');
    });

    it.each([
        ['malformed metadata', { docs: { data: docsRow({ duem: 'false' }), error: null } }],
        ['malformed word', { words: { data: [{ word: 1 }], error: null } }],
        ['malformed wait word', { waitWords: { data: [{ word: '라면', requested_by: null, request_type: 'edit' }], error: null } }],
        ['malformed star', { stars: { data: [{ user_id: 1 }], error: null } }],
        ['metadata error', { docs: { data: null, error: { message: 'private' } } }],
        ['stars error', { stars: { data: null, error: { message: 'private' } } }],
        ['words error', { words: { data: null, error: { message: 'private' } } }],
        ['wait words error', { waitWords: { data: null, error: { message: 'private' } } }],
        ['theme error', { docs: { data: docsRow({ typez: 'theme' }), error: null }, themes: { data: null, error: { message: 'private' } } }],
        ['thrown metadata query', { docs: new Error('private') }],
        ['thrown star query', { stars: new Error('private') }],
        ['thrown word query', { words: new Error('private') }],
    ] as const)('returns the stable infrastructure error for %s', async (_name, responses) => {
        const { client } = createClient(responses);
        await expect(new SupabaseDocsContentQueryGateway(client).loadByDocsId(61)).resolves.toEqual(err(infrastructureError));
    });
});
