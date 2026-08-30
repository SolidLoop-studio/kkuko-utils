import { GetAdminDashboardSummaryService } from '@/src/modules/admin-dashboard/application/get-admin-dashboard-summary';
import type { AdminDashboardQueryGateway } from '@/src/modules/admin-dashboard/application/admin-dashboard-query-ports';
import type { AdminDashboardSummary } from '@/src/modules/admin-dashboard/application/admin-dashboard-query-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const summary: AdminDashboardSummary = {
    totalWords: 123_456,
    pendingWordChanges: 17,
};

const stableError = {
    kind: 'infrastructure' as const,
    message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
};

const createGateway = (
    result: Result<AdminDashboardSummary> = ok(summary),
): jest.Mocked<AdminDashboardQueryGateway> => ({
    loadSummary: jest.fn().mockResolvedValue(result),
});

describe('GetAdminDashboardSummaryService', () => {
    test.each([
        [{ totalWords: 0, pendingWordChanges: 0 }],
        [summary],
    ])('returns only the validated count projection for %#', async (projection) => {
        // Break caught: dropping valid zero counts or exposing Infrastructure-only response fields.
        const gateway = createGateway(ok({
            ...projection,
            privateDiagnostic: 'must not cross the boundary',
        } as unknown as AdminDashboardSummary));

        await expect(new GetAdminDashboardSummaryService(gateway).get()).resolves.toEqual(
            ok(projection),
        );
        expect(gateway.loadSummary).toHaveBeenCalledTimes(1);
    });

    test.each([
        [{ totalWords: null, pendingWordChanges: 0 }],
        [{ totalWords: -1, pendingWordChanges: 0 }],
        [{ totalWords: 1.5, pendingWordChanges: 0 }],
        [{ totalWords: Number.MAX_SAFE_INTEGER + 1, pendingWordChanges: 0 }],
        [{ totalWords: 0, pendingWordChanges: null }],
        [{ totalWords: 0, pendingWordChanges: -1 }],
        [{ totalWords: 0, pendingWordChanges: 1.5 }],
        [{ totalWords: 0, pendingWordChanges: Number.MAX_SAFE_INTEGER + 1 }],
    ])('normalizes malformed projection %# to the stable Korean error', async (projection) => {
        // Break caught: allowing null, negative, fractional, or unsafe counts into the UI contract.
        const gateway = createGateway(ok(projection as unknown as AdminDashboardSummary));

        await expect(new GetAdminDashboardSummaryService(gateway).get()).resolves.toEqual(
            err(stableError),
        );
    });

    test.each([
        ['returned', createGateway(err({
            kind: 'infrastructure',
            message: 'private PostgREST detail',
        }))],
        ['thrown', {
            loadSummary: jest.fn().mockRejectedValue(new Error('private Supabase detail')),
        }],
    ])('normalizes a %s gateway failure without leaking diagnostics', async (_kind, gateway) => {
        // Break caught: forwarding a gateway's raw error message across the Application boundary.
        await expect(new GetAdminDashboardSummaryService(gateway).get()).resolves.toEqual(
            err(stableError),
        );
    });
});
