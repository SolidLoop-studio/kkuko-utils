import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseDocsViewCommandGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-view-command-gateway';

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 조회 수 기록에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

const createClient = (response: unknown | Error) => {
    const calls: Array<{ name: string; args: unknown }> = [];
    return {
        client: {
            rpc: async (name: string, args: unknown) => {
                calls.push({ name, args });
                if (response instanceof Error) throw response;
                return response;
            },
        },
        calls,
    };
};

describe('SupabaseDocsViewCommandGateway', () => {
    it('calls the docs view RPC with the supplied docs ID', async () => {
        // Break caught: invoking a different RPC or sending a malformed view command payload.
        const { client, calls } = createClient({ data: undefined, error: null });

        await expect(new SupabaseDocsViewCommandGateway(client).record(55))
            .resolves.toEqual(ok(undefined));
        expect(calls).toEqual([{
            name: 'increment_doc_views',
            args: { doc_id: 55 },
        }]);
    });

    it.each([
        ['returned Supabase error', { data: undefined, error: { message: 'private detail' } }],
        ['thrown RPC failure', new Error('private connection detail')],
        ['malformed RPC response', null],
        ['missing error field', { data: undefined }],
    ])('returns a stable infrastructure error for a %s', async (_description, response) => {
        // Break caught: leaking or mishandling any RPC failure instead of returning the command contract's stable error.
        const { client } = createClient(response);

        await expect(new SupabaseDocsViewCommandGateway(client).record(55))
            .resolves.toEqual(err(infrastructureError));
    });
});
