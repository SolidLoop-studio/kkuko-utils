import { GetProfileWordRequestsService } from '@/src/modules/identity/application/get-profile-word-requests';
import type { ProfileWordRequestsQueryGateway } from '@/src/modules/identity/application/profile-word-requests-query-ports';
import type { ProfileWordRequest } from '@/src/modules/identity/application/profile-word-requests-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const wordRequests: ProfileWordRequest[] = [{
    id: 42,
    word: '테스트단어',
    requestType: 'add',
    requestedAt: '2026-08-27T00:00:00.000Z',
    status: 'pending',
}];

const createGateway = (
    result: Result<ProfileWordRequest[]> = ok(wordRequests),
): jest.Mocked<ProfileWordRequestsQueryGateway> => ({
    loadByRequesterId: jest.fn().mockResolvedValue(result),
});

describe('GetProfileWordRequestsService', () => {
    test('trims a requester ID and exposes only the word-request projection', async () => {
        // Break caught: forwarding whitespace or leaking request-row fields beyond the application boundary.
        const gateway = createGateway();

        await expect(new GetProfileWordRequestsService(gateway).get('  user-1  ')).resolves.toEqual(ok(wordRequests));
        expect(gateway.loadByRequesterId).toHaveBeenCalledWith('user-1');
    });

    test('rejects a blank requester ID without loading infrastructure', async () => {
        // Break caught: querying request history before a bounded profile user is available.
        const gateway = createGateway();

        await expect(new GetProfileWordRequestsService(gateway).get('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'userId',
            message: '프로필 사용자 ID가 필요합니다.',
        }));
        expect(gateway.loadByRequesterId).not.toHaveBeenCalled();
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private database detail' }))],
        ['a thrown gateway failure', {
            loadByRequesterId: jest.fn().mockRejectedValue(new Error('private database detail')),
        }],
    ])('maps %s to the stable word-request infrastructure error', async (_description, gateway) => {
        // Break caught: exposing returned or thrown gateway diagnostics to the profile page.
        await expect(new GetProfileWordRequestsService(gateway).get('user-1')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
