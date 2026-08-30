import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseDocsRequestQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-request-query-gateway';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

type QueryResult = QueryResponse | Error;

class FakeDocsRequestQuery implements PromiseLike<QueryResponse> {
    constructor(
        private readonly result: QueryResult,
        private readonly selectedColumns: string[],
    ) {}

    select(columns: string): this {
        this.selectedColumns.push(columns);
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
            from: jest.fn(() => new FakeDocsRequestQuery(result, selectedColumns)),
        },
        selectedColumns,
    };
};

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
};

describe('SupabaseDocsRequestQueryGateway', () => {
    it('maps pending requests and selects only the required columns', async () => {
        const { client, selectedColumns } = createClient({
            data: [{
                id: 11,
                req_at: '2026-08-22T00:00:00.000Z',
                docs_name: '가',
                req_by: '00000000-0000-0000-0000-000000000011',
                users: { nickname: '신청자 A' },
            }],
            error: null,
        });
        const gateway = new SupabaseDocsRequestQueryGateway(client);

        await expect(gateway.loadPending()).resolves.toEqual(ok([{
            id: 11,
            requestedAt: '2026-08-22T00:00:00.000Z',
            docsName: '가',
            requesterNickname: '신청자 A',
            requesterId: '00000000-0000-0000-0000-000000000011',
        }]));
        expect(client.from).toHaveBeenCalledWith('docs_wait');
        expect(selectedColumns).toEqual(['id, req_at, docs_name, req_by, users(nickname)']);
    });

    it('maps a null joined user to a null requester nickname', async () => {
        const { client } = createClient({
            data: [{
                id: 12,
                req_at: '2026-08-22T01:00:00.000Z',
                docs_name: '나',
                req_by: '00000000-0000-0000-0000-000000000012',
                users: null,
            }],
            error: null,
        });

        await expect(new SupabaseDocsRequestQueryGateway(client).loadPending()).resolves.toEqual(ok([{
            id: 12,
            requestedAt: '2026-08-22T01:00:00.000Z',
            docsName: '나',
            requesterNickname: null,
            requesterId: '00000000-0000-0000-0000-000000000012',
        }]));
    });

    it.each([
        ['Supabase error response', { data: [], error: { message: 'private database detail' } }],
        ['thrown query', new Error('private connection detail')],
        ['malformed row', { data: [{ id: '13' }], error: null }],
    ])('returns a stable infrastructure error for a %s', async (_description, result) => {
        const { client } = createClient(result);

        await expect(new SupabaseDocsRequestQueryGateway(client).loadPending())
            .resolves.toEqual(err(infrastructureError));
    });
});
