import { GetProfileFavoriteDocsService } from '@/src/modules/identity/application/get-profile-favorite-docs';
import type { ProfileFavoriteDocsQueryGateway } from '@/src/modules/identity/application/profile-favorite-docs-query-ports';
import type { ProfileFavoriteDoc } from '@/src/modules/identity/application/profile-favorite-docs-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const favoriteDocs: ProfileFavoriteDoc[] = [{
    id: 42,
    name: '테스트 문서',
    type: 'theme',
    lastUpdatedAt: '2026-08-27T00:00:00.000Z',
}];

const createGateway = (
    result: Result<ProfileFavoriteDoc[]> = ok(favoriteDocs),
): jest.Mocked<ProfileFavoriteDocsQueryGateway> => ({
    loadByUserId: jest.fn().mockResolvedValue(result),
});

describe('GetProfileFavoriteDocsService', () => {
    test('trims a user ID and exposes only the favorite-documents projection', async () => {
        // Break caught: forwarding whitespace or leaking favorite-row fields beyond the application boundary.
        const gateway = createGateway();

        await expect(new GetProfileFavoriteDocsService(gateway).get('  user-1  ')).resolves.toEqual(ok(favoriteDocs));
        expect(gateway.loadByUserId).toHaveBeenCalledWith('user-1');
    });

    test('rejects a blank user ID without loading infrastructure', async () => {
        // Break caught: querying favorites without a bounded profile user ID.
        const gateway = createGateway();

        await expect(new GetProfileFavoriteDocsService(gateway).get('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'userId',
            message: '프로필 사용자 ID가 필요합니다.',
        }));
        expect(gateway.loadByUserId).not.toHaveBeenCalled();
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private database detail' }))],
        ['a thrown gateway failure', {
            loadByUserId: jest.fn().mockRejectedValue(new Error('private database detail')),
        }],
    ])('maps %s to the stable favorite-documents infrastructure error', async (_description, gateway) => {
        // Break caught: exposing returned or thrown gateway diagnostics to the profile page.
        await expect(new GetProfileFavoriteDocsService(gateway).get('user-1')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
