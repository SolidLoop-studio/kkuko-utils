import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { SupabaseDocsCreationRequestGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-creation-request-gateway';

class FakeDocsCreationRequestInsert implements PromiseLike<unknown> {
    readonly rows: unknown[] = [];

    constructor(private readonly result: unknown | Error) {}

    insert(row: unknown): this {
        this.rows.push(row);
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

const createClient = (result: unknown | Error) => {
    const query = new FakeDocsCreationRequestInsert(result);
    return {
        client: { from: jest.fn(() => query) },
        query,
    };
};

const command = { docsName: '가', requesterId: 'user-7' };
const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

describe('SupabaseDocsCreationRequestGateway', () => {
    it('inserts only the docs name and requester ID', async () => {
        const { client, query } = createClient({ data: null, error: null });
        const gateway = new SupabaseDocsCreationRequestGateway(client);

        await expect(gateway.request(command)).resolves.toEqual(ok(undefined));
        expect(client.from).toHaveBeenCalledWith('docs_wait');
        expect(query.rows).toEqual([{
            docs_name: '가',
            req_by: 'user-7',
        }]);
    });

    it.each([
        ['Supabase error', { data: null, error: { message: 'private detail' } }],
        ['thrown insert', new Error('private connection detail')],
        ['malformed response', null],
        ['missing error field', { data: null }],
    ])('returns a stable infrastructure error for a %s', async (_description, response) => {
        const { client } = createClient(response);

        await expect(new SupabaseDocsCreationRequestGateway(client).request(command))
            .resolves.toEqual(err(infrastructureError));
    });
});
