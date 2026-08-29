import { GetAdminLogsPageService } from '@/src/modules/admin-logs/application/get-admin-logs-page';
import type { AdminLogsPageQueryGateway } from '@/src/modules/admin-logs/application/admin-logs-page-query-ports';
import type {
    AdminLogsPageProjection,
    AdminLogsPageQuery,
} from '@/src/modules/admin-logs/application/admin-logs-page-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const stableInfrastructureError = err({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const validationError = err({
    kind: 'validation' as const,
    message: '올바른 관리자 로그 조회 조건이 필요합니다.',
});

const wordQuery: AdminLogsPageQuery = {
    page: 2,
    pageSize: 30,
    fromDate: '2026-08-01T00:00:00.000Z',
    toDate: '2026-08-31T23:59:59.999Z',
    filter: { kind: 'word', state: 'approved', requestType: 'add' },
};

const docsQuery: AdminLogsPageQuery = {
    page: 1,
    pageSize: 150,
    filter: { kind: 'docs', documentName: '주제 문서', type: 'delete' },
};

const wordProjection: AdminLogsPageProjection = {
    kind: 'word',
    items: [{
        id: 11,
        word: '가나',
        state: 'approved',
        requestType: 'add',
        requesterNickname: '신청자',
        processorNickname: '관리자',
        createdAt: '2026-08-29T00:00:00.000Z',
    }],
    totalCount: 31,
    page: 2,
    pageSize: 30,
};

const docsProjection: AdminLogsPageProjection = {
    kind: 'docs',
    items: [{
        id: 21,
        word: '다라',
        documentName: '주제 문서',
        actorNickname: null,
        type: 'delete',
        occurredAt: '2026-08-28T00:00:00.000Z',
    }],
    totalCount: 1,
    page: 1,
    pageSize: 150,
};

const createGateway = (
    result: Result<AdminLogsPageProjection> = ok(wordProjection),
): jest.Mocked<AdminLogsPageQueryGateway> => ({
    loadPage: jest.fn().mockResolvedValue(result),
});

const invalidQueries: AdminLogsPageQuery[] = [
    { ...wordQuery, page: 0 },
    { ...wordQuery, page: Number.MAX_SAFE_INTEGER + 1 },
    { ...wordQuery, page: 1.5 },
    { ...wordQuery, pageSize: 100 } as unknown as AdminLogsPageQuery,
    { ...wordQuery, fromDate: 'not-an-iso-date' },
    { ...wordQuery, fromDate: '2026-02-30T00:00:00.000Z' },
    { ...wordQuery, fromDate: '2026-08-31T00:00:00.000Z', toDate: '2026-08-01T00:00:00.000Z' },
];

const mismatchedProjections: AdminLogsPageProjection[] = [
    { ...wordProjection, kind: 'docs' } as unknown as AdminLogsPageProjection,
    { ...wordProjection, page: 1 },
    { ...wordProjection, pageSize: 150 },
];

describe('GetAdminLogsPageService', () => {
    test.each([
        [wordQuery, wordProjection],
        [docsQuery, docsProjection],
    ])('returns the matching %s query projection', async (query, projection) => {
        // Break caught: rejecting a supported tab filter or reshaping its browser-independent DTO.
        const gateway = createGateway(ok(projection));

        await expect(new GetAdminLogsPageService(gateway).get(query)).resolves.toEqual(ok(projection));
        expect(gateway.loadPage).toHaveBeenCalledWith(query);
    });

    test.each(invalidQueries)('returns a stable validation error for an invalid query', async (query) => {
        // Break caught: sending unsafe pagination or invalid date bounds into the Infrastructure adapter.
        const gateway = createGateway();

        await expect(new GetAdminLogsPageService(gateway).get(query)).resolves.toEqual(validationError);
        expect(gateway.loadPage).not.toHaveBeenCalled();
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private database detail' }))],
        ['a thrown gateway failure', { loadPage: jest.fn().mockRejectedValue(new Error('private database detail')) }],
    ])('maps %s to one stable public error', async (_description, gateway) => {
        // Break caught: exposing a lower-level or thrown Infrastructure diagnostic to Presentation.
        await expect(new GetAdminLogsPageService(gateway).get(wordQuery)).resolves.toEqual(
            stableInfrastructureError,
        );
    });

    test.each(mismatchedProjections)('rejects a gateway projection that does not match the requested tab or page', async (projection) => {
        // Break caught: rendering a result for another tab or pagination window after a stale/refetched query.
        const gateway = createGateway(ok(projection));

        await expect(new GetAdminLogsPageService(gateway).get(wordQuery)).resolves.toEqual(
            stableInfrastructureError,
        );
    });
});
