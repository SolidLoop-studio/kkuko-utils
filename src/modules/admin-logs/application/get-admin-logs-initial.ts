import { err, type Result } from '@/src/shared/application/result';
import type { AdminLogsInitialQueryGateway } from './admin-logs-initial-query-ports';
import type { AdminLogsInitialProjection } from './admin-logs-initial-query-types';

const adminLogsInitialError = () => ({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

/** 관리자 로그 화면의 초기 projection을 안전한 공개 경계로 조회합니다. */
export class GetAdminLogsInitialService {
    constructor(private readonly gateway: AdminLogsInitialQueryGateway) {}

    async get(): Promise<Result<AdminLogsInitialProjection>> {
        try {
            const result = await this.gateway.loadInitial();
            if (!result.ok) return err(adminLogsInitialError());
            return result;
        } catch {
            return err(adminLogsInitialError());
        }
    }
}
