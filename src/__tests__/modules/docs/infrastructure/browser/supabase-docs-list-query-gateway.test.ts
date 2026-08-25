import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseDocsListQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-list-query-gateway';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

type QueryResult = QueryResponse | Error;

class FakeDocsListQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly selectedColumns: string[],
    ) {}

    select(columns: string): this {
        this.selectedColumns.push(columns);
        return this;
    }

    eq(_column: string, _value: boolean): this {
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

const createClient = (result: QueryResult) => {
    const selectedColumns: string[] = [];
    return {
        client: {
            from: jest.fn(() => new FakeDocsListQuery(result, selectedColumns)),
        },
        selectedColumns,
    };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
};

describe('SupabaseDocsListQueryGateway', () => {
    it('maps docs summaries and selects only the fields required by the list', async () => {
        const { client, selectedColumns } = createClient({
            data: [{
                id: 31,
                name: '가',
                users: null,
                last_update: '2026-08-25T01:00:00.000Z',
                created_at: '2026-08-20T01:00:00.000Z',
                typez: 'letter',
            }],
            error: null,
        });

        await expect(new SupabaseDocsListQueryGateway(client).loadAll()).resolves.toEqual(ok([{
            id: 31,
            name: '가',
            makerNickname: null,
            lastUpdatedAt: '2026-08-25T01:00:00.000Z',
            createdAt: '2026-08-20T01:00:00.000Z',
            type: 'letter',
        }]));
        expect(client.from).toHaveBeenCalledWith('docs');
        expect(selectedColumns).toEqual(['id, name, typez, last_update, created_at, users(nickname)']);
    });

    it('maps a maker nickname when the joined user exists', async () => {
        const { client } = createClient({
            data: [{
                id: 32,
                name: '나',
                users: { nickname: '제작자' },
                last_update: '2026-08-25T02:00:00.000Z',
                created_at: '2026-08-20T02:00:00.000Z',
                typez: 'theme',
            }],
            error: null,
        });

        await expect(new SupabaseDocsListQueryGateway(client).loadAll()).resolves.toEqual(ok([{
            id: 32,
            name: '나',
            makerNickname: '제작자',
            lastUpdatedAt: '2026-08-25T02:00:00.000Z',
            createdAt: '2026-08-20T02:00:00.000Z',
            type: 'theme',
        }]));
    });

    it.each(['letter', 'theme', 'ect'] as const)('maps the allowed %s docs type', async (type) => {
        const { client } = createClient({
            data: [{
                id: 33,
                name: '다',
                users: null,
                last_update: '2026-08-25T03:00:00.000Z',
                created_at: '2026-08-20T03:00:00.000Z',
                typez: type,
            }],
            error: null,
        });

        await expect(new SupabaseDocsListQueryGateway(client).loadAll()).resolves.toEqual(ok([{
            id: 33,
            name: '다',
            makerNickname: null,
            lastUpdatedAt: '2026-08-25T03:00:00.000Z',
            createdAt: '2026-08-20T03:00:00.000Z',
            type,
        }]));
    });

    it.each([
        ['Supabase error response', { data: [], error: { message: 'private database detail' } }],
        ['thrown query', new Error('private connection detail')],
        ['malformed row', { data: [{ id: '34' }], error: null }],
    ])('returns a stable infrastructure error for a %s', async (_description, result) => {
        const { client } = createClient(result);

        await expect(new SupabaseDocsListQueryGateway(client).loadAll())
            .resolves.toEqual(err(infrastructureError));
    });
});
