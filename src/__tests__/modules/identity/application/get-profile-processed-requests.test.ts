import { GetProfileProcessedRequestsService } from '@/src/modules/identity/application/get-profile-processed-requests';
import type { ProfileProcessedRequestsQueryGateway } from '@/src/modules/identity/application/profile-processed-requests-query-ports';
import type { ProfileProcessedRequest } from '@/src/modules/identity/application/profile-processed-requests-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const processedRequests: ProfileProcessedRequest[] = [{
    id: 43,
    word: '처리단어',
    createdAt: '2026-08-27T00:00:00.000Z',
    state: 'approved',
    requestType: 'delete',
}];

const createGateway = (
    result: Result<ProfileProcessedRequest[]> = ok(processedRequests),
): jest.Mocked<ProfileProcessedRequestsQueryGateway> => ({
    loadByMakerId: jest.fn().mockResolvedValue(result),
});

describe('GetProfileProcessedRequestsService', () => {
    test('trims a maker ID and exposes only the processed-request projection', async () => {
        // Break caught: forwarding whitespace or leaking log-row fields beyond the application boundary.
        const gateway = createGateway();

        await expect(new GetProfileProcessedRequestsService(gateway).get('  user-1  ')).resolves.toEqual(ok(processedRequests));
        expect(gateway.loadByMakerId).toHaveBeenCalledWith('user-1');
    });

    test('rejects a blank maker ID without loading infrastructure', async () => {
        // Break caught: querying processed activity before a bounded profile user is available.
        const gateway = createGateway();

        await expect(new GetProfileProcessedRequestsService(gateway).get('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'userId',
            message: '프로필 사용자 ID가 필요합니다.',
        }));
        expect(gateway.loadByMakerId).not.toHaveBeenCalled();
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private database detail' }))],
        ['a thrown gateway failure', {
            loadByMakerId: jest.fn().mockRejectedValue(new Error('private database detail')),
        }],
    ])('maps %s to the stable processed-request infrastructure error', async (_description, gateway) => {
        // Break caught: exposing returned or thrown gateway diagnostics to the profile page.
        await expect(new GetProfileProcessedRequestsService(gateway).get('user-1')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '처리된 요청을 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
