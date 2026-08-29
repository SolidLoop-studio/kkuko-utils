import { GetAdminLogsInitialService } from '@/src/modules/admin-logs/application/get-admin-logs-initial';
import type { AdminLogsInitialQueryGateway } from '@/src/modules/admin-logs/application/admin-logs-initial-query-ports';
import type { AdminLogsInitialProjection } from '@/src/modules/admin-logs/application/admin-logs-initial-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const projection: AdminLogsInitialProjection = {
    documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
};

const createGateway = (
    result: Result<AdminLogsInitialProjection> = ok(projection),
): jest.Mocked<AdminLogsInitialQueryGateway> => ({
    loadInitial: jest.fn().mockResolvedValue(result),
});

describe('GetAdminLogsInitialService', () => {
    test('returns only the initial document choices', async () => {
        // Break caught: keeping log rows in the initial query after page queries own them.
        const gateway = createGateway();

        await expect(new GetAdminLogsInitialService(gateway).get()).resolves.toEqual(ok(projection));
        expect(gateway.loadInitial).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private database detail' }))],
        ['a thrown gateway failure', { loadInitial: jest.fn().mockRejectedValue(new Error('private database detail')) }],
    ])('maps %s to one stable public error', async (_description, gateway) => {
        // Break caught: exposing a lower-level or thrown infrastructure diagnostic to Presentation.
        await expect(new GetAdminLogsInitialService(gateway).get()).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
