import { GetAdminLogsInitialService } from '@/src/modules/admin-logs/application/get-admin-logs-initial';
import type { AdminLogsInitialQueryGateway } from '@/src/modules/admin-logs/application/admin-logs-initial-query-ports';
import type { AdminLogsInitialProjection } from '@/src/modules/admin-logs/application/admin-logs-initial-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const projection: AdminLogsInitialProjection = {
    wordLogs: [{
        id: 11,
        word: '가나',
        state: 'approved',
        requestType: 'add',
        requesterNickname: '신청자',
        processorNickname: '관리자',
        createdAt: '2026-08-29T00:00:00.000Z',
    }],
    docsLogs: [{
        id: 21,
        word: '다라',
        documentName: '주제 문서',
        actorNickname: null,
        type: 'delete',
        occurredAt: '2026-08-28T00:00:00.000Z',
    }],
    documentChoices: [{ id: 31, name: '주제 문서', type: 'theme' }],
};

const createGateway = (
    result: Result<AdminLogsInitialProjection> = ok(projection),
): jest.Mocked<AdminLogsInitialQueryGateway> => ({
    loadInitial: jest.fn().mockResolvedValue(result),
});

describe('GetAdminLogsInitialService', () => {
    test('returns the narrow initial administrator-log projection', async () => {
        // Break caught: skipping the gateway or reshaping the projection above Application.
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
