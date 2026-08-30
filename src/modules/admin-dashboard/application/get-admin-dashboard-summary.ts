import { err, ok, type Result } from '@/src/shared/application/result';
import type { AdminDashboardQueryGateway } from './admin-dashboard-query-ports';
import type { AdminDashboardSummary } from './admin-dashboard-query-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
});

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

/** 관리자 화면에 필요한 두 개의 안전한 집계 값만 조회합니다. */
export class GetAdminDashboardSummaryService {
    constructor(private readonly gateway: AdminDashboardQueryGateway) {}

    async get(): Promise<Result<AdminDashboardSummary>> {
        try {
            const result = await this.gateway.loadSummary();
            if (!result.ok
                || !isNonNegativeSafeInteger(result.value.totalWords)
                || !isNonNegativeSafeInteger(result.value.pendingWordChanges)) {
                return err(infrastructureError());
            }

            return ok({
                totalWords: result.value.totalWords,
                pendingWordChanges: result.value.pendingWordChanges,
            });
        } catch {
            return err(infrastructureError());
        }
    }
}
