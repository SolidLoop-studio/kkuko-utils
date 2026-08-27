import { GetProfileSummaryService } from '@/src/modules/identity/application/get-profile-summary';
import type { ProfileSummaryQueryGateway } from '@/src/modules/identity/application/profile-summary-query-ports';
import type { ProfileSummarySource } from '@/src/modules/identity/application/profile-summary-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const source: ProfileSummarySource = {
    id: 'user-1',
    nickname: '테스터',
    role: 'r2',
    totalContribution: 120,
    monthlyContribution: 42,
    monthlyContributionRank: 3,
    historicalMonthlyContributions: [
        { month: '2025-12', contribution: 99 },
        { month: '2026-04', contribution: 4 },
        { month: '2026-06', contribution: 6 },
        { month: '2026-07', contribution: 5 },
        { month: '2026-07', contribution: 7 },
        { month: '2026-08', contribution: 8 },
    ],
};

const createGateway = (
    result: Result<ProfileSummarySource | null> = ok(source),
): jest.Mocked<ProfileSummaryQueryGateway> => ({
    loadByNickname: jest.fn().mockResolvedValue(result),
});

describe('GetProfileSummaryService', () => {
    test('trims a nickname and fills the five recent months with the authoritative current value', async () => {
        // Break caught: forwarding whitespace or producing an incomplete/non-deterministic chart projection.
        const gateway = createGateway();
        const service = new GetProfileSummaryService(
            gateway,
            () => new Date('2026-08-27T03:00:00+09:00'),
        );

        await expect(service.get('  테스터  ')).resolves.toEqual(ok({
            id: 'user-1',
            nickname: '테스터',
            role: 'r2',
            totalContribution: 120,
            monthlyContribution: 42,
            monthlyContributionRank: 3,
            recentMonthlyContributions: [
                { month: '2026-04', contribution: 4 },
                { month: '2026-05', contribution: 0 },
                { month: '2026-06', contribution: 6 },
                { month: '2026-07', contribution: 7 },
                { month: '2026-08', contribution: 42 },
            ],
        }));
        expect(gateway.loadByNickname).toHaveBeenCalledWith('테스터');
    });

    test('rejects a blank nickname without loading infrastructure', async () => {
        // Break caught: querying an unbounded profile lookup for blank input.
        const gateway = createGateway();

        await expect(new GetProfileSummaryService(gateway).get('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'nickname',
            message: '닉네임을 입력해주세요.',
        }));
        expect(gateway.loadByNickname).not.toHaveBeenCalled();
    });

    test('maps a missing profile to a stable not-found error', async () => {
        // Break caught: treating a valid empty user response as successful dummy profile data.
        const gateway = createGateway(ok(null));

        await expect(new GetProfileSummaryService(gateway).get('없는사용자')).resolves.toEqual(err({
            kind: 'not-found',
            message: '사용자를 찾을 수 없습니다.',
        }));
    });

    test('forwards an exact gateway error Result', async () => {
        // Break caught: changing a stable gateway failure at the application boundary.
        const failure = { kind: 'forbidden' as const, message: '프로필 조회 권한이 없습니다.' };
        const gateway = createGateway(err(failure));

        await expect(new GetProfileSummaryService(gateway).get('테스터')).resolves.toEqual(err(failure));
    });

    test('maps a rejected gateway promise to a stable infrastructure error', async () => {
        // Break caught: leaking rejected query details through the application boundary.
        const gateway: jest.Mocked<ProfileSummaryQueryGateway> = {
            loadByNickname: jest.fn().mockRejectedValue(new Error('private database details')),
        };

        await expect(new GetProfileSummaryService(gateway).get('테스터')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
