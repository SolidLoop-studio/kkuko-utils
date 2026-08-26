import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseDocsFavoriteCommandGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-favorite-command-gateway';

const infrastructureError = {
    kind: 'infrastructure' as const,
    message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
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

describe('SupabaseDocsFavoriteCommandGateway', () => {
    it.each([true, false])(
        'calls the desired-state RPC without a browser-supplied user ID when isStarred is %p',
        async (isStarred) => {
            // Break caught: using a table write, toggle RPC, or caller-provided identity instead of the command contract.
            const { client, calls } = createClient({ data: null, error: null });

            await expect(new SupabaseDocsFavoriteCommandGateway(client).set({
                docsId: 55,
                isStarred,
            })).resolves.toEqual(ok(undefined));
            expect(calls).toEqual([{
                name: 'set_docs_favorite',
                args: { p_docs_id: 55, p_is_starred: isStarred },
            }]);
        },
    );

    it.each([
        [
            'DOCS_FAVORITE_UNAUTHORIZED',
            { kind: 'unauthorized', message: '인증이 필요합니다.', code: 'P0001' },
        ],
        [
            'DOCS_FAVORITE_NOT_FOUND',
            { kind: 'not-found', message: '문서를 찾을 수 없습니다.', code: 'P0001' },
        ],
    ] as const)('maps public RPC error %s for UI handling', async (message, expectedError) => {
        // Break caught: collapsing actionable authentication/not-found failures into raw or generic errors.
        const { client } = createClient({
            data: null,
            error: { code: 'P0001', message },
        });

        await expect(new SupabaseDocsFavoriteCommandGateway(client).set({
            docsId: 55,
            isStarred: true,
        })).resolves.toEqual(err(expectedError));
    });

    it.each([
        ['internal public code', { data: null, error: { code: 'P0001', message: 'DOCS_FAVORITE_INTERNAL_ERROR' } }],
        ['unknown database error', { data: null, error: { code: 'XX000', message: 'private detail' } }],
        ['thrown RPC failure', new Error('private connection detail')],
        ['malformed response', null],
        ['missing error field', { data: null }],
        ['malformed error', { data: null, error: { message: 17 } }],
    ])('returns a stable infrastructure error for an %s', async (_description, response) => {
        // Break caught: leaking unexpected database or transport details into the existing ErrorModal.
        const { client } = createClient(response);

        await expect(new SupabaseDocsFavoriteCommandGateway(client).set({
            docsId: 55,
            isStarred: true,
        })).resolves.toEqual(err(infrastructureError));
    });
});
