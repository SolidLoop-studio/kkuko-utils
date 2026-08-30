jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseProfileFavoriteDocsQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-favorite-docs-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const stableError = err({
    kind: 'infrastructure' as const,
    message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.',
});

const createGateway = ({
    response = {
        data: [{
            docs: {
                id: 42,
                name: '테스트 문서',
                typez: 'theme',
                last_update: '2026-08-27T00:00:00.000Z',
            },
        }],
        error: null,
    },
    throws = false,
}: { response?: unknown; throws?: boolean } = {}) => {
    const eq = jest.fn(() => (throws ? Promise.reject(new Error('private database detail')) : Promise.resolve(response)));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));

    return {
        gateway: new SupabaseProfileFavoriteDocsQueryGateway({ from } as never),
        from,
        select,
        eq,
    };
};

describe('SupabaseProfileFavoriteDocsQueryGateway', () => {
    test('queries a profile user favorites and maps the ordered rows to the narrow camelCase projection', async () => {
        // Break caught: changing the favorite relation/query scope or losing backend order in the public projection.
        const { gateway, from, select, eq } = createGateway({
            response: {
                data: [
                    { docs: { id: 9, name: '첫 문서', typez: 'letter', last_update: '2026-08-27T00:00:00.000Z' } },
                    { docs: { id: 2, name: '둘 문서', typez: 'ect', last_update: '2026-08-26T00:00:00.000Z' } },
                ],
                error: null,
            },
        });

        await expect(gateway.loadByUserId('user-1')).resolves.toEqual(ok([
            { id: 9, name: '첫 문서', type: 'letter', lastUpdatedAt: '2026-08-27T00:00:00.000Z' },
            { id: 2, name: '둘 문서', type: 'ect', lastUpdatedAt: '2026-08-26T00:00:00.000Z' },
        ]));
        expect(from).toHaveBeenCalledWith('user_star_docs');
        expect(select).toHaveBeenCalledWith('docs(id, name, typez, last_update)');
        expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    test.each([
        ['a returned query error', { data: null, error: { message: 'private database detail' } }, false],
        ['a thrown query error', undefined, true],
        ['a malformed related document', { data: [{ docs: { id: 0, name: '문서', typez: 'theme', last_update: '2026-08-27' } }], error: null }, false],
        ['an unsupported document type', { data: [{ docs: { id: 1, name: '문서', typez: 'private', last_update: '2026-08-27' } }], error: null }, false],
    ])('maps %s to one stable public error', async (_description, response, throws) => {
        // Break caught: leaking database diagnostics or malformed rows beyond infrastructure.
        const { gateway } = createGateway({ response, throws });

        await expect(gateway.loadByUserId('user-1')).resolves.toEqual(stableError);
    });
});
