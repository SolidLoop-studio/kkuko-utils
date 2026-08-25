import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseLetterDocsDuplicateQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-letter-docs-duplicate-query-gateway';

type QueryResult = unknown | Error;

class FakeLetterDocsDuplicateQuery implements PromiseLike<unknown> {
    readonly selectedColumns: string[] = [];
    readonly equalFilters: Array<[string, unknown]> = [];
    readonly limits: number[] = [];

    constructor(private readonly result: QueryResult) {}

    select(columns: string): this {
        this.selectedColumns.push(columns);
        return this;
    }

    eq(column: string, value: unknown): this {
        this.equalFilters.push([column, value]);
        return this;
    }

    limit(count: number): this {
        this.limits.push(count);
        return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return (this.result instanceof Error
            ? Promise.reject(this.result)
            : Promise.resolve(this.result)
        ).then(onfulfilled, onrejected);
    }
}

const createClient = (result: QueryResult) => {
    const query = new FakeLetterDocsDuplicateQuery(result);
    return {
        client: { from: jest.fn(() => query) },
        query,
    };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

describe('SupabaseLetterDocsDuplicateQueryGateway', () => {
    it.each([
        [{ data: [], error: null }, false],
        [{ data: [{ id: 280 }], error: null }, true],
    ])('maps a well-formed response to duplicate existence', async (response, expected) => {
        const { client, query } = createClient(response);
        const gateway = new SupabaseLetterDocsDuplicateQueryGateway(client);

        await expect(gateway.existsByName('가')).resolves.toEqual(ok(expected));
        expect(client.from).toHaveBeenCalledWith('docs');
        expect(query.selectedColumns).toEqual(['id']);
        expect(query.equalFilters).toEqual([
            ['typez', 'letter'],
            ['name', '가'],
        ]);
        expect(query.limits).toEqual([1]);
    });

    it.each([
        ['Supabase error', { data: [], error: { message: 'private detail' } }],
        ['thrown query', new Error('private connection detail')],
        ['malformed response', null],
        ['malformed array', { data: 'not-an-array', error: null }],
        ['malformed row', { data: [{ id: '280' }], error: null }],
        ['multiple rows', { data: [{ id: 280 }, { id: 281 }], error: null }],
    ])('returns a stable infrastructure error for a %s', async (_description, response) => {
        const { client } = createClient(response);

        await expect(new SupabaseLetterDocsDuplicateQueryGateway(client).existsByName('가'))
            .resolves.toEqual(err(infrastructureError));
    });

    it('rejects a sparse one-slot response array', async () => {
        const sparseData: unknown[] = [];
        sparseData.length = 1;
        const { client } = createClient({ data: sparseData, error: null });

        await expect(new SupabaseLetterDocsDuplicateQueryGateway(client).existsByName('가'))
            .resolves.toEqual(err(infrastructureError));
    });
});
