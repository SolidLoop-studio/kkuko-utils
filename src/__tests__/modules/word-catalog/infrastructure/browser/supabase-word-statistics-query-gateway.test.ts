import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseWordStatisticsQueryGateway } from '@/src/modules/word-catalog/infrastructure/browser/supabase-word-statistics-query-gateway';

type QueryResponse = { data: unknown; error: unknown };
type QueryResult = QueryResponse | Error;
type Table = 'word_first_letter_counts' | 'word_last_letter_counts';
type Operation = { method: 'from' | 'select'; table: Table; args: unknown[] };

class FakeQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly table: Table,
        private readonly operations: Operation[],
    ) {}

    select(columns: string): this {
        this.operations.push({ method: 'select', table: this.table, args: [columns] });
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

const createClient = (results: Partial<Record<Table, QueryResult>> = {}) => {
    const operations: Operation[] = [];
    const client = {
        from(table: Table) {
            operations.push({ method: 'from', table, args: [] });
            return new FakeQuery(results[table] ?? response([]), table, operations);
        },
    };
    return { client, operations };
};

const firstLetterRow = {
    first_letter: '가',
    k_count: 11,
    n_count: 7,
    k_count_updated_at: '2026-08-24T00:00:00Z',
    n_count_updated_at: null,
    len3_k_count: 5,
    len3_n_count: 3,
    len3_k_count_updated_at: '2026-08-23T00:00:00Z',
    len3_n_count_updated_at: null,
};

const lastLetterRow = {
    last_letter: '나',
    k_count: 13,
    n_count: 2,
    k_count_updated_at: null,
    n_count_updated_at: '2026-08-22T00:00:00Z',
};

const infrastructureFailure = err({
    kind: 'infrastructure',
    message: '데이터를 불러오는 중 오류가 발생했습니다.',
});

describe('SupabaseWordStatisticsQueryGateway', () => {
    test('projects first-letter rows into first-letter and three-letter statistics and last-letter rows in source order', async () => {
        const { client, operations } = createClient({
            word_first_letter_counts: response([firstLetterRow, {
                ...firstLetterRow,
                first_letter: '나',
                k_count: 17,
                len3_k_count: 9,
            }]),
            word_last_letter_counts: response([lastLetterRow]),
        });

        await expect(new SupabaseWordStatisticsQueryGateway(client).load()).resolves.toEqual(ok({
            firstLetter: [
                {
                    letter: '가',
                    acknowledgedCount: 11,
                    notAcknowledgedCount: 7,
                    acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
                    notAcknowledgedUpdatedAt: null,
                },
                {
                    letter: '나',
                    acknowledgedCount: 17,
                    notAcknowledgedCount: 7,
                    acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
                    notAcknowledgedUpdatedAt: null,
                },
            ],
            lastLetter: [{
                letter: '나',
                acknowledgedCount: 13,
                notAcknowledgedCount: 2,
                acknowledgedUpdatedAt: null,
                notAcknowledgedUpdatedAt: '2026-08-22T00:00:00Z',
            }],
            threeLetter: [
                {
                    letter: '가',
                    acknowledgedCount: 5,
                    notAcknowledgedCount: 3,
                    acknowledgedUpdatedAt: '2026-08-23T00:00:00Z',
                    notAcknowledgedUpdatedAt: null,
                },
                {
                    letter: '나',
                    acknowledgedCount: 9,
                    notAcknowledgedCount: 3,
                    acknowledgedUpdatedAt: '2026-08-23T00:00:00Z',
                    notAcknowledgedUpdatedAt: null,
                },
            ],
        }));
        expect(operations).toEqual([
            { method: 'from', table: 'word_first_letter_counts', args: [] },
            {
                method: 'select',
                table: 'word_first_letter_counts',
                args: ['first_letter, k_count, n_count, k_count_updated_at, n_count_updated_at, len3_k_count, len3_n_count, len3_k_count_updated_at, len3_n_count_updated_at'],
            },
            { method: 'from', table: 'word_last_letter_counts', args: [] },
            {
                method: 'select',
                table: 'word_last_letter_counts',
                args: ['last_letter, k_count, n_count, k_count_updated_at, n_count_updated_at'],
            },
        ]);
    });

    test('accepts empty statistics arrays', async () => {
        const { client } = createClient();

        await expect(new SupabaseWordStatisticsQueryGateway(client).load()).resolves.toEqual(ok({
            firstLetter: [],
            lastLetter: [],
            threeLetter: [],
        }));
    });

    test.each([
        ['a query error', createClient({ word_first_letter_counts: response([], { message: 'private' }) }).client],
        ['a thrown query', createClient({ word_last_letter_counts: new Error('network') }).client],
        ['a blank letter', createClient({ word_first_letter_counts: response([{ ...firstLetterRow, first_letter: ' ' }]) }).client],
        ['an invalid count', createClient({ word_last_letter_counts: response([{ ...lastLetterRow, n_count: '2' }]) }).client],
        ['an invalid timestamp', createClient({ word_first_letter_counts: response([{ ...firstLetterRow, k_count_updated_at: 0 }]) }).client],
    ])('returns the stable infrastructure error for %s', async (_description, client) => {
        await expect(new SupabaseWordStatisticsQueryGateway(client).load())
            .resolves.toEqual(infrastructureFailure);
    });
});
