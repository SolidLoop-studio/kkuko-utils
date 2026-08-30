import { GetCurrentUserProfileService } from '@/src/modules/identity/application/get-current-user-profile';
import type { CurrentUserProfileQueryGateway } from '@/src/modules/identity/application/user-profile-query-ports';
import { err, ok } from '@/src/shared/application/result';

const profile = {
    id: 'user-1',
    nickname: '테스터',
    role: 'r2' as const,
};

describe('GetCurrentUserProfileService', () => {
    test('rejects a blank user ID without querying infrastructure', async () => {
        // Break caught: issuing a public profile query without an authenticated identity.
        const gateway: jest.Mocked<CurrentUserProfileQueryGateway> = {
            loadByUserId: jest.fn(),
        };

        await expect(new GetCurrentUserProfileService(gateway).get('   ')).resolves.toEqual(err({
            kind: 'validation',
            message: '올바른 사용자 ID가 필요합니다.',
        }));
        expect(gateway.loadByUserId).not.toHaveBeenCalled();
    });

    test.each([
        ['an existing profile', profile],
        ['a missing profile for nickname registration', null],
    ])('returns %s as an explicit query result', async (_description, value) => {
        // Break caught: treating a missing profile as an auth failure instead of the new-user state.
        const gateway: jest.Mocked<CurrentUserProfileQueryGateway> = {
            loadByUserId: jest.fn().mockResolvedValue(ok(value)),
        };

        await expect(new GetCurrentUserProfileService(gateway).get('user-1')).resolves.toEqual(ok(value));
    });

    test('maps a rejected profile query to a stable application error', async () => {
        // Break caught: exposing a rejected database query outside the identity application boundary.
        const gateway: jest.Mocked<CurrentUserProfileQueryGateway> = {
            loadByUserId: jest.fn().mockRejectedValue(new Error('users row details')),
        };

        await expect(new GetCurrentUserProfileService(gateway).get('user-1')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
