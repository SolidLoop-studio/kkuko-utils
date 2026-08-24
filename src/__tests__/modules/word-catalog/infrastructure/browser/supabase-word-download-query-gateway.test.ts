import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseWordDownloadQueryGateway } from '@/src/modules/word-catalog/infrastructure/browser/supabase-word-download-query-gateway';

type QueryResponse = { data: unknown; error: unknown };
type QueryResult = QueryResponse | Error;
type Operation = { method: 'from' | 'select' | 'eq'; table: string; args: unknown[] };

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly table: string,
        private readonly operations: Operation[],
    ) {}

    select(columns: string): this {
        this.operations.push({ method: 'select', table: this.table, args: [columns] });
        return this;
    }

    eq(column: string, value: unknown): this {
        this.operations.push({ method: 'eq', table: this.table, args: [column, value] });
        return this;
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result))
            .then(onfulfilled, onrejected);
    }
}

const response = (data: unknown, error: unknown = null): QueryResponse => ({ data, error });

const createClient = (results: Partial<Record<'words' | 'wait_words', QueryResult>> = {}) => {
    const operations: Operation[] = [];
    const client = {
        from(table: 'words' | 'wait_words') {
            operations.push({ method: 'from', table, args: [] });
            return new FakeQuery(results[table] ?? response([]), table, operations);
        },
    };
    return { client, operations };
};

const baseFilter = {
    includeAcknowledged: true,
    includeNotAcknowledged: true,
    onlyWordChain: false,
};

const infrastructureFailure = err({
    kind: 'infrastructure',
    message: '데이터를 불러오는 중 오류가 발생했습니다.',
});

describe('SupabaseWordDownloadQueryGateway', () => {
    test('maps word and pending-request rows without a word-class equality filter when both are selected', async () => {
        const { client, operations } = createClient({
            words: response([{ word: '가나', noin_canuse: false, k_canuse: true }]),
            wait_words: response([{ word: '나다', request_type: 'add' }]),
        });

        await expect(new SupabaseWordDownloadQueryGateway(client).load(baseFilter)).resolves.toEqual(ok({
            registeredWords: [{ word: '가나', isNoInjung: false, canUseInWordChain: true }],
            pendingRequests: [{ word: '나다', type: 'add' }],
        }));
        expect(operations).toEqual([
            { method: 'from', table: 'words', args: [] },
            { method: 'select', table: 'words', args: ['word, noin_canuse, k_canuse'] },
            { method: 'from', table: 'wait_words', args: [] },
            { method: 'select', table: 'wait_words', args: ['word, request_type'] },
        ]);
    });

    test.each([
        ['acknowledged-only', { includeAcknowledged: true, includeNotAcknowledged: false, onlyWordChain: false }, ['noin_canuse', false]],
        ['non-acknowledged-only', { includeAcknowledged: false, includeNotAcknowledged: true, onlyWordChain: false }, ['noin_canuse', true]],
        ['word-chain-only', { includeAcknowledged: true, includeNotAcknowledged: true, onlyWordChain: true }, ['k_canuse', true]],
    ])('applies the %s registered-word filter', async (_description, filter, equality) => {
        const { client, operations } = createClient();

        await new SupabaseWordDownloadQueryGateway(client).load(filter);

        expect(operations).toContainEqual({ method: 'eq', table: 'words', args: equality });
    });

    test.each([
        ['a query error', createClient({ words: response([], { message: 'private' }) }).client],
        ['a thrown query', createClient({ wait_words: new Error('network') }).client],
        ['a malformed registered row', createClient({ words: response([{ word: '', noin_canuse: false, k_canuse: true }]) }).client],
        ['a malformed pending-request row', createClient({ wait_words: response([{ word: '가나', request_type: 'update' }]) }).client],
    ])('returns the stable infrastructure error for %s', async (_description, client) => {
        await expect(new SupabaseWordDownloadQueryGateway(client).load(baseFilter))
            .resolves.toEqual(infrastructureFailure);
    });
});
