import { err, ok } from '@/src/shared/application/result';
import type { ApplicationError } from '@/src/shared/application/application-error';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SupabaseWordDetailQueryGateway } from '@/src/modules/word-catalog/infrastructure/browser/supabase-word-detail-query-gateway';

type QueryResponse = {
    data: unknown;
    error: { message: string } | null;
    count?: number | null;
};

type QueryResult = QueryResponse | Error;

type QueryOperation = {
    method: 'from' | 'select' | 'eq' | 'in' | 'or' | 'maybeSingle';
    table?: string;
    args: unknown[];
};

type Fixture = Partial<Record<
    'words' | 'wait_words' | 'word_themes' | 'word_themes_wait' | 'wait_word_themes'
    | 'docs' | 'word_last_letter_counts' | 'word_first_letter_counts',
    QueryResult[]
>>;

const response = (data: unknown, error: { message: string } | null = null, count?: number | null): QueryResponse => ({
    data,
    error,
    ...(count === undefined ? {} : { count }),
});

const coreError: ApplicationError = {
    kind: 'infrastructure',
    code: 'WORD_DETAIL_QUERY_FAILED',
    message: '단어 정보를 불러오는 중 오류가 발생했습니다.',
};

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly queryResult: QueryResult,
        private readonly table: string,
        private readonly operations: QueryOperation[],
    ) {}

    select(columns: string, options?: { count?: 'exact'; head?: boolean }): this {
        this.operations.push({ method: 'select', table: this.table, args: [columns, options] });
        return this;
    }

    eq(column: string, value: unknown): this {
        this.operations.push({ method: 'eq', table: this.table, args: [column, value] });
        return this;
    }

    in(column: string, values: readonly unknown[]): this {
        this.operations.push({ method: 'in', table: this.table, args: [column, values] });
        return this;
    }

    or(filters: string): this {
        this.operations.push({ method: 'or', table: this.table, args: [filters] });
        return this;
    }

    maybeSingle(): Promise<QueryResponse> {
        this.operations.push({ method: 'maybeSingle', table: this.table, args: [] });
        return this.resolve();
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.resolve().then(onfulfilled, onrejected);
    }

    private resolve(): Promise<QueryResponse> {
        return this.queryResult instanceof Error
            ? Promise.reject(this.queryResult)
            : Promise.resolve(this.queryResult);
    }
}

const createQueryClient = (fixture: Fixture = {}) => {
    const defaults: Record<string, QueryResult[]> = {
        words: [response(null)],
        wait_words: [response(null), response(null, null, 0), response(null, null, 0)],
        word_themes: [response([])],
        word_themes_wait: [response([])],
        wait_word_themes: [response([])],
        docs: [response([]), response([])],
        word_last_letter_counts: [response([])],
        word_first_letter_counts: [response([])],
    };
    const responses = new Map(Object.entries({ ...defaults, ...fixture }).map(([table, values]) => [
        table,
        [...values],
    ]));
    const operations: QueryOperation[] = [];
    const client = {
        from(table: string) {
            operations.push({ method: 'from', table, args: [] });
            const queue = responses.get(table);
            if (!queue || queue.length === 0) {
                throw new Error(`Unexpected ${table} query`);
            }
            return new FakeQuery(queue.shift()!, table, operations);
        },
        rpc: jest.fn(),
    };
    return { client, operations };
};

const approvedWord = {
    id: 7,
    word: '나비',
    k_canuse: true,
    noin_canuse: false,
    added_by: 'adder-1',
    added_at: '2026-08-20T00:00:00.000Z',
    users: { nickname: '추가자' },
};

const registeredFixture = (): Fixture => ({
    words: [response(approvedWord)],
    wait_words: [response(null), response(null, null, 1), response(null, null, 1)],
    word_themes: [response([{ themes: { name: '동물' } }, { themes: { name: '지명' } }])],
    word_themes_wait: [response([
        { typez: 'add', themes: { name: '곤충' } },
        { typez: 'delete', themes: { name: '지명' } },
    ])],
    docs: [response([{ id: 10, name: '비' }]), response([{ id: 11, name: '동물' }, { id: 11, name: '동물' }])],
    word_last_letter_counts: [response([{ count: 7 }])],
    word_first_letter_counts: [response([{ count: 4 }])],
});

describe('SupabaseWordDetailQueryGateway', () => {
    it('maps an approved word with pending theme changes, documents, and connection counts', async () => {
        const { client, operations } = createQueryClient(registeredFixture());
        const gateway = new SupabaseWordDetailQueryGateway(client);

        const result = await gateway.findDetail('나비');

        expect(result).toEqual(ok({
            id: 7,
            word: '나비',
            status: 'registered',
            canUseInChain: true,
            canUseWithoutInjeong: false,
            requesterId: 'adder-1',
            requesterNickname: '추가자',
            requestedAt: '2026-08-20T00:00:00.000Z',
            themes: {
                approved: ['동물'],
                pendingAddition: ['곤충'],
                pendingDeletion: ['지명'],
            },
            documents: [
                { id: 10, name: '비' },
                { id: 11, name: '동물' },
                { id: 11, name: '동물' },
            ],
            previousWordCount: 8,
            nextWordCount: 5,
        }));
        expect(operations).toEqual(expect.arrayContaining([
            { method: 'in', table: 'word_last_letter_counts', args: ['last_letter', ['나', '라']] },
            { method: 'or', table: 'wait_words', args: ['word.ilike.%나,word.ilike.%라'] },
            { method: 'eq', table: 'word_first_letter_counts', args: ['first_letter', '비'] },
            { method: 'or', table: 'wait_words', args: ['word.ilike.비%'] },
        ]));
    });

    it('gives an approved word pending-deletion status and deletion requester metadata', async () => {
        const fixture = registeredFixture();
        fixture.wait_words = [response({
            id: 15,
            word: '나비',
            request_type: 'delete',
            requested_by: 'deleter-1',
            requested_at: '2026-08-21T00:00:00.000Z',
            users: { nickname: '삭제자' },
        }), response(null, null, 0), response(null, null, 0)];
        const { client } = createQueryClient(fixture);

        await expect(new SupabaseWordDetailQueryGateway(client).findDetail('나비')).resolves.toEqual(ok(expect.objectContaining({
            status: 'pending-deletion',
            requesterId: 'deleter-1',
            requesterNickname: '삭제자',
            requestedAt: '2026-08-21T00:00:00.000Z',
        })));
    });

    it('maps a lone add request with default capability flags and pending themes', async () => {
        const { client } = createQueryClient({
            words: [response(null)],
            wait_words: [response({
                id: 21,
                word: '잠자리',
                request_type: 'add',
                requested_by: 'adder-2',
                requested_at: '2026-08-22T00:00:00.000Z',
                users: { nickname: '요청자' },
            }), response(null, null, 0), response(null, null, 0)],
            wait_word_themes: [response([{ themes: { name: '곤충' } }])],
            docs: [response([]), response([])],
            word_last_letter_counts: [response([])],
            word_first_letter_counts: [response([])],
        });

        await expect(new SupabaseWordDetailQueryGateway(client).findDetail('잠자리')).resolves.toEqual(ok({
            id: 21,
            word: '잠자리',
            status: 'pending-addition',
            canUseInChain: true,
            canUseWithoutInjeong: false,
            requesterId: 'adder-2',
            requesterNickname: '요청자',
            requestedAt: '2026-08-22T00:00:00.000Z',
            themes: { approved: [], pendingAddition: ['곤충'], pendingDeletion: [] },
            documents: [],
            previousWordCount: 0,
            nextWordCount: 0,
        }));
    });

    it('returns null when neither an approved word nor a pending request exists', async () => {
        const { client } = createQueryClient();

        await expect(new SupabaseWordDetailQueryGateway(client).findDetail('없는단어'))
            .resolves.toEqual(ok(null));
    });

    it('returns an approved previous connected word without querying pending words', async () => {
        const { client } = createQueryClient();
        client.rpc.mockResolvedValueOnce(response([{ word: '나비' }]));

        await expect(new SupabaseWordDetailQueryGateway(client).findRandomConnectedWord({
            direction: 'previous',
            letters: ['나', '라'],
        })).resolves.toEqual(ok('나비'));

        expect(client.rpc).toHaveBeenCalledTimes(1);
        expect(client.rpc).toHaveBeenCalledWith('random_word_ff', { fir1: ['나', '라'] });
    });

    it('falls back to a pending next connected word when no approved word is available', async () => {
        const { client } = createQueryClient();
        client.rpc
            .mockResolvedValueOnce(response([]))
            .mockResolvedValueOnce(response([{ word: '비누' }]));

        await expect(new SupabaseWordDetailQueryGateway(client).findRandomConnectedWord({
            direction: 'next',
            letters: ['비'],
        })).resolves.toEqual(ok('비누'));

        expect(client.rpc.mock.calls).toEqual([
            ['random_word_ll', { fir1: ['비'] }],
            ['random_wait_word_ll', { prefixes: ['비'] }],
        ]);
    });

    it('returns null when neither approved nor pending connected words are available', async () => {
        const { client } = createQueryClient();
        client.rpc
            .mockResolvedValueOnce(response([]))
            .mockResolvedValueOnce(response([]));

        await expect(new SupabaseWordDetailQueryGateway(client).findRandomConnectedWord({
            direction: 'previous',
            letters: ['나'],
        })).resolves.toEqual(ok(null));
    });

    it('returns the stable infrastructure error for malformed connected-word rows', async () => {
        const { client } = createQueryClient();
        client.rpc.mockResolvedValueOnce(response([{ word: '비누' }, { word: ' ' }]));

        await expect(new SupabaseWordDetailQueryGateway(client).findRandomConnectedWord({
            direction: 'next',
            letters: ['비'],
        })).resolves.toEqual(err(coreError));
    });

    it.each([
        ['the approved connected-word RPC', [response([], { message: 'private' })]],
        ['the pending connected-word RPC', [response([]), response([], { message: 'private' })]],
    ])('returns the stable infrastructure error when %s fails', async (_description, rpcResponses: QueryResponse[]) => {
        const { client } = createQueryClient();
        for (const rpcResponse of rpcResponses) {
            client.rpc.mockResolvedValueOnce(rpcResponse);
        }

        await expect(new SupabaseWordDetailQueryGateway(client).findRandomConnectedWord({
            direction: 'previous',
            letters: ['나'],
        })).resolves.toEqual(err(coreError));
    });

    it.each([
        ['a core query error', () => createQueryClient({ words: [response(null, { message: 'private' })] }).client],
        ['a malformed approved word', () => createQueryClient({ words: [response({ id: '7', word: '나비' })] }).client],
        ['a theme query error', () => {
            const fixture = registeredFixture();
            fixture.word_themes = [response([], { message: 'private' })];
            return createQueryClient(fixture).client;
        }],
        ['a document query error', () => {
            const fixture = registeredFixture();
            fixture.docs = [response([], { message: 'private' }), response([])];
            return createQueryClient(fixture).client;
        }],
    ])('returns the stable infrastructure error for %s', async (_description, createClient) => {
        await expect(new SupabaseWordDetailQueryGateway(createClient()).findDetail('나비'))
            .resolves.toEqual(err(coreError));
    });

    it('returns the stable infrastructure error when a follow-up theme query rejects', async () => {
        const fixture = registeredFixture();
        fixture.word_themes = [new Error('network failure')];
        const { client } = createQueryClient(fixture);

        await expect(new SupabaseWordDetailQueryGateway(client).findDetail('나비'))
            .resolves.toEqual(err(coreError));
    });

    it.each([
        ['previous', (fixture: Fixture) => {
            fixture.word_last_letter_counts = [response([], { message: 'count failure' })];
        }],
        ['next', (fixture: Fixture) => {
            fixture.wait_words = [response(null), response(null, null, 1), response(null, { message: 'count failure' })];
        }],
    ])('degrades only the %s connection count when one of its count queries fails', async (direction, breakDirection) => {
        const fixture = registeredFixture();
        breakDirection(fixture);
        const { client } = createQueryClient(fixture);

        const result = await new SupabaseWordDetailQueryGateway(client).findDetail('나비');

        expect(result).toEqual(ok(expect.objectContaining(
            direction === 'previous'
                ? { previousWordCount: 0, nextWordCount: 5 }
                : { previousWordCount: 8, nextWordCount: 0 },
        )));
    });

    it.each([
        ['previous', 'missing', (fixture: Fixture) => {
            fixture.wait_words = [response(null), response(null), response(null, null, 1)];
        }],
        ['previous', 'null', (fixture: Fixture) => {
            fixture.wait_words = [response(null), response(null, null, null), response(null, null, 1)];
        }],
        ['next', 'missing', (fixture: Fixture) => {
            fixture.wait_words = [response(null), response(null, null, 1), response(null)];
        }],
        ['next', 'null', (fixture: Fixture) => {
            fixture.wait_words = [response(null), response(null, null, 1), response(null, null, null)];
        }],
    ])('degrades the %s count when the exact pending count is %s', async (direction, _kind, breakDirection) => {
        const fixture = registeredFixture();
        breakDirection(fixture);
        const { client } = createQueryClient(fixture);

        await expect(new SupabaseWordDetailQueryGateway(client).findDetail('나비')).resolves.toEqual(ok(expect.objectContaining(
            direction === 'previous'
                ? { previousWordCount: 0, nextWordCount: 5 }
                : { previousWordCount: 8, nextWordCount: 0 },
        )));
    });
});
