import { SearchProfilesByNicknameService } from '@/src/modules/identity/application/search-profiles-by-nickname';
import type { ProfileSearchQueryGateway } from '@/src/modules/identity/application/profile-search-query-ports';
import { err, ok } from '@/src/shared/application/result';

const profiles = [{
    id: 'user-1',
    nickname: '테스터',
    role: 'r2' as const,
    totalContribution: 120,
    monthlyContribution: 12,
}];

describe('SearchProfilesByNicknameService', () => {
    test('trims a nickname query before forwarding it to the gateway', async () => {
        // Break caught: searching literal whitespace rather than the submitted nickname.
        const gateway: jest.Mocked<ProfileSearchQueryGateway> = {
            searchByNickname: jest.fn().mockResolvedValue(ok(profiles)),
        };

        await expect(new SearchProfilesByNicknameService(gateway).search('  테스터  '))
            .resolves.toEqual(ok(profiles));
        expect(gateway.searchByNickname).toHaveBeenCalledWith('테스터');
    });

    test('rejects a blank nickname without querying infrastructure', async () => {
        // Break caught: issuing an unbounded users query for blank input.
        const gateway: jest.Mocked<ProfileSearchQueryGateway> = {
            searchByNickname: jest.fn(),
        };

        await expect(new SearchProfilesByNicknameService(gateway).search('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'nickname',
            message: '검색할 닉네임을 입력해주세요.',
        }));
        expect(gateway.searchByNickname).not.toHaveBeenCalled();
    });

    test('forwards an exact gateway Result', async () => {
        // Break caught: changing a stable gateway failure at the application boundary.
        const failure = { kind: 'forbidden' as const, message: '사용자 검색 권한이 없습니다.' };
        const gateway: jest.Mocked<ProfileSearchQueryGateway> = {
            searchByNickname: jest.fn().mockResolvedValue(err(failure)),
        };

        await expect(new SearchProfilesByNicknameService(gateway).search('테스터'))
            .resolves.toEqual(err(failure));
    });

    test('maps a rejected gateway promise to a stable infrastructure error', async () => {
        // Break caught: leaking rejected database query details through the application boundary.
        const gateway: jest.Mocked<ProfileSearchQueryGateway> = {
            searchByNickname: jest.fn().mockRejectedValue(new Error('private database details')),
        };

        await expect(new SearchProfilesByNicknameService(gateway).search('테스터')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '사용자 검색 중 오류가 발생했습니다.',
        }));
    });
});
