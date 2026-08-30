import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabasePendingWordModerationQueryGateway } from '@/src/modules/word-moderation/infrastructure/browser/supabase-pending-word-moderation-query-gateway';

type TableName = 'word_themes_wait' | 'wait_words' | 'wait_word_themes';
type QueryResponse = { data: unknown; error: unknown };

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly response: QueryResponse | Error,
        private readonly calls: string[],
    ) {}

    select(columns: string): this {
        this.calls.push(`select:${columns}`);
        return this;
    }

    order(column: string, options: { ascending: boolean }): this {
        this.calls.push(`order:${column}:${options.ascending}`);
        return this;
    }

    in(column: string, values: number[]): this {
        this.calls.push(`in:${column}:${values.join(',')}`);
        return this;
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.response instanceof Error
            ? Promise.reject(this.response)
            : Promise.resolve(this.response)
        ).then(onfulfilled, onrejected);
    }
}

const createClient = (responses: Record<TableName, Array<QueryResponse | Error>>) => {
    const calls: string[] = [];
    const queues = new Map<TableName, Array<QueryResponse | Error>>(
        Object.entries(responses) as Array<[TableName, Array<QueryResponse | Error>]>,
    );
    const client = {
        from: jest.fn((table: TableName) => {
            calls.push(`from:${table}`);
            const response = queues.get(table)?.shift();
            if (response === undefined) throw new Error(`Unexpected query: ${table}`);
            return new FakeQuery(response, calls);
        }),
    };
    return { client, calls };
};

const success = (data: unknown): QueryResponse => ({ data, error: null });
const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
};

describe('SupabasePendingWordModerationQueryGateway', () => {
    it('projects stable business keys and identical grouped requests when database rows are permuted', async () => {
        // Break caught: deriving grouped request identity or metadata from the unordered response index.
        const themeRows = [
            {
                word_id: 10, theme_id: 3, typez: 'delete', req_at: '2026-08-26T01:00:00.000Z', req_by: 'older-user',
                words: { id: 10, word: '가' }, themes: { id: 3, name: '셋', code: 'three' }, users: { nickname: '이전 요청자' },
            },
            {
                word_id: 10, theme_id: 1, typez: 'delete', req_at: '2026-08-26T02:00:00.000Z', req_by: 'tie-user-1',
                words: { id: 10, word: '가' }, themes: { id: 1, name: '하나', code: 'one' }, users: { nickname: '동시 요청자 1' },
            },
            {
                word_id: 10, theme_id: 2, typez: 'add', req_at: '2026-08-26T02:00:00.000Z', req_by: 'tie-user-2',
                words: { id: 10, word: '가' }, themes: { id: 2, name: '둘', code: 'two' }, users: { nickname: '동시 요청자 2' },
            },
            {
                word_id: 20, theme_id: 4, typez: 'add', req_at: '2026-08-26T03:00:00.000Z', req_by: null,
                words: { id: 20, word: '가' }, themes: { id: 4, name: '넷', code: 'four' }, users: null,
            },
        ];
        const waitRows = [{
            id: 10, word: '나', request_type: 'delete', requested_at: '2026-08-26T04:00:00.000Z', requested_by: null,
            users: null, words: { id: 30 },
        }];
        const first = createClient({
            word_themes_wait: [success(themeRows)],
            wait_words: [success(waitRows)],
            wait_word_themes: [],
        });
        const second = createClient({
            word_themes_wait: [success([themeRows[2], themeRows[3], themeRows[0], themeRows[1]])],
            wait_words: [success(waitRows)],
            wait_word_themes: [],
        });

        const firstResult = await new SupabasePendingWordModerationQueryGateway(first.client).loadPending();
        const secondResult = await new SupabasePendingWordModerationQueryGateway(second.client).loadPending();
        const expected = ok([
            {
                requestKey: 'theme-change:10',
                id: 10,
                word: '가', requestType: 'theme_change', requestedAt: '2026-08-26T02:00:00.000Z',
                requesterId: 'tie-user-2', requesterNickname: '동시 요청자 2', wordId: 10,
                themes: [
                    { id: 1, name: '하나', code: 'one', type: 'delete' },
                    { id: 2, name: '둘', code: 'two', type: 'add' },
                    { id: 3, name: '셋', code: 'three', type: 'delete' },
                ],
            },
            {
                requestKey: 'theme-change:20',
                id: 20,
                word: '가', requestType: 'theme_change', requestedAt: '2026-08-26T03:00:00.000Z',
                requesterNickname: 'unknow', wordId: 20,
                themes: [{ id: 4, name: '넷', code: 'four', type: 'add' }],
            },
            {
                requestKey: 'word-request:10',
                id: 10,
                word: '나', requestType: 'delete', requestedAt: '2026-08-26T04:00:00.000Z',
                requesterNickname: 'unknown', wordId: 30,
            },
        ]);

        expect(firstResult).toEqual(expected);
        expect(secondResult).toEqual(expected);
    });

    it('preserves deterministic grouped-theme ordering, request ordering, and fallbacks', async () => {
        // Break caught: changing the queue order or fallback semantics while assembling the projection.
        const { client, calls } = createClient({
            word_themes_wait: [success([
                {
                    word_id: 20, theme_id: 3, typez: 'delete', req_at: '2026-08-26T03:00:00.000Z', req_by: null,
                    words: { id: 20, word: '나' }, themes: { id: 3, name: '나 주제', code: 'na' }, users: null,
                },
                {
                    word_id: 10, theme_id: 2, typez: 'add', req_at: '2026-08-26T01:00:00.000Z', req_by: 'user-1',
                    words: { id: 10, word: '가' }, themes: { id: 2, name: '둘', code: 'two' }, users: { nickname: '첫째' },
                },
                {
                    word_id: 10, theme_id: 1, typez: 'delete', req_at: '2026-08-26T02:00:00.000Z', req_by: 'user-2',
                    words: { id: 10, word: '가' }, themes: { id: 1, name: '하나', code: 'one' }, users: { nickname: null },
                },
            ])],
            wait_words: [success([
                {
                    id: 7, word: '다', request_type: 'add', requested_at: '2026-08-26T04:00:00.000Z', requested_by: null,
                    users: null, words: null,
                },
                {
                    id: 8, word: '라', request_type: 'delete', requested_at: '2026-08-26T05:00:00.000Z', requested_by: 'user-8',
                    users: { nickname: '삭제자' }, words: { id: 80 },
                },
            ])],
            wait_word_themes: [success([
                { wait_word_id: 7, theme_id: 4, themes: { id: 4, name: '넷', code: 'four' }, wait_words: { word: '다' } },
            ])],
        });

        await expect(new SupabasePendingWordModerationQueryGateway(client).loadPending())
            .resolves.toEqual(ok([
                {
                    requestKey: 'theme-change:10',
                    id: 10,
                    word: '가', requestType: 'theme_change', requestedAt: '2026-08-26T02:00:00.000Z',
                    requesterId: 'user-2', requesterNickname: 'unknow', wordId: 10,
                    themes: [
                        { id: 1, name: '하나', code: 'one', type: 'delete' },
                        { id: 2, name: '둘', code: 'two', type: 'add' },
                    ],
                },
                {
                    requestKey: 'theme-change:20',
                    id: 20,
                    word: '나', requestType: 'theme_change', requestedAt: '2026-08-26T03:00:00.000Z',
                    requesterNickname: 'unknow', wordId: 20,
                    themes: [{ id: 3, name: '나 주제', code: 'na', type: 'delete' }],
                },
                {
                    requestKey: 'word-request:7',
                    id: 7,
                    word: '다', requestType: 'add', requestedAt: '2026-08-26T04:00:00.000Z',
                    requesterNickname: 'unknown',
                    themes: [{ id: 4, name: '넷', code: 'four', type: 'add' }],
                },
                {
                    requestKey: 'word-request:8',
                    id: 8,
                    word: '라', requestType: 'delete', requestedAt: '2026-08-26T05:00:00.000Z',
                    requesterId: 'user-8', requesterNickname: '삭제자', wordId: 80,
                },
            ]));
        expect(calls).toEqual([
            'from:word_themes_wait',
            'select:word_id, theme_id, typez, req_at, req_by, words(id, word), themes(id, name, code), users(nickname)',
            'from:wait_words',
            'select:id, word, request_type, requested_at, requested_by, words(id), users(nickname)',
            'order:requested_at:true',
            'from:wait_word_themes',
            'select:wait_word_id, theme_id, themes(id, name, code)',
            'in:wait_word_id:7',
        ]);
    });

    it('chunks addition request IDs at the existing 300-ID boundary', async () => {
        const waitWords = Array.from({ length: 301 }, (_, index) => ({
            id: index + 1,
            word: `word-${index + 1}`,
            request_type: 'add',
            requested_at: `2026-08-26T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
            requested_by: null,
            users: null,
            words: null,
        }));
        const { client, calls } = createClient({
            word_themes_wait: [success([])],
            wait_words: [success(waitWords)],
            wait_word_themes: [success([]), success([])],
        });

        const result = await new SupabasePendingWordModerationQueryGateway(client).loadPending();

        expect(result.ok).toBe(true);
        expect(calls.filter((call) => call.startsWith('in:wait_word_id:'))).toHaveLength(2);
        expect(calls.find((call) => call.startsWith('in:wait_word_id:1,'))?.split(',')).toHaveLength(300);
        expect(calls).toContain('in:wait_word_id:301');
    });

    it('skips the wait-word-theme query when there are no addition requests', async () => {
        const { client, calls } = createClient({
            word_themes_wait: [success([])],
            wait_words: [success([{
                id: 8,
                word: '삭제어',
                request_type: 'delete',
                requested_at: '2026-08-26T05:00:00.000Z',
                requested_by: null,
                users: null,
                words: { id: 80 },
            }])],
            wait_word_themes: [],
        });

        await expect(new SupabasePendingWordModerationQueryGateway(client).loadPending())
            .resolves.toEqual(ok([{
                requestKey: 'word-request:8',
                id: 8,
                word: '삭제어',
                requestType: 'delete',
                requestedAt: '2026-08-26T05:00:00.000Z',
                requesterNickname: 'unknown',
                wordId: 80,
            }]));
        expect(calls).toEqual([
            'from:word_themes_wait',
            'select:word_id, theme_id, typez, req_at, req_by, words(id, word), themes(id, name, code), users(nickname)',
            'from:wait_words',
            'select:id, word, request_type, requested_at, requested_by, words(id), users(nickname)',
            'order:requested_at:true',
        ]);
    });

    it.each([
        ['returned error', { data: [], error: { message: 'private wait-word detail' } }],
        ['malformed row', success([{ id: 'invalid' }])],
    ])('stops after a wait_words %s and returns the stable error', async (_label, failure) => {
        const { client, calls } = createClient({
            word_themes_wait: [success([])],
            wait_words: [failure],
            wait_word_themes: [],
        });

        await expect(new SupabasePendingWordModerationQueryGateway(client).loadPending())
            .resolves.toEqual(err(infrastructureError));
        expect(calls).toEqual([
            'from:word_themes_wait',
            'select:word_id, theme_id, typez, req_at, req_by, words(id, word), themes(id, name, code), users(nickname)',
            'from:wait_words',
            'select:id, word, request_type, requested_at, requested_by, words(id), users(nickname)',
            'order:requested_at:true',
        ]);
    });

    it('maps a thrown failure in a later wait-word-theme chunk after preserving query order', async () => {
        const waitWords = Array.from({ length: 301 }, (_, index) => ({
            id: index + 1,
            word: `word-${index + 1}`,
            request_type: 'add',
            requested_at: '2026-08-26T00:00:00.000Z',
            requested_by: null,
            users: null,
            words: null,
        }));
        const { client, calls } = createClient({
            word_themes_wait: [success([])],
            wait_words: [success(waitWords)],
            wait_word_themes: [success([]), new Error('private second chunk detail')],
        });

        await expect(new SupabasePendingWordModerationQueryGateway(client).loadPending())
            .resolves.toEqual(err(infrastructureError));
        expect(calls.filter((call) => call === 'from:wait_word_themes')).toHaveLength(2);
        expect(calls.filter((call) => call.startsWith('in:wait_word_id:'))).toEqual([
            `in:wait_word_id:${Array.from({ length: 300 }, (_, index) => index + 1).join(',')}`,
            'in:wait_word_id:301',
        ]);
        expect(calls.at(-1)).toBe('in:wait_word_id:301');
    });

    it.each([
        ['returned database failure', { data: [], error: { message: 'private database detail' } }],
        ['thrown database failure', new Error('private connection detail')],
        ['malformed row', success([{ word_id: 'invalid' }])],
    ])('maps a %s at any persistence stage to one stable error', async (_label, failure) => {
        const { client } = createClient({
            word_themes_wait: [failure],
            wait_words: [success([])],
            wait_word_themes: [],
        });

        await expect(new SupabasePendingWordModerationQueryGateway(client).loadPending())
            .resolves.toEqual(err(infrastructureError));
        expect(client.from).toHaveBeenCalledTimes(1);
    });
});
