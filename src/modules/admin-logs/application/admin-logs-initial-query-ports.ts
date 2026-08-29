import type { Result } from '@/src/shared/application/result';
import type { AdminLogsInitialProjection } from './admin-logs-initial-query-types';

export interface AdminLogsInitialQueryGateway {
    /** 로그 행은 page query가 소유하므로 초기 문서 선택지만 조회합니다. */
    loadInitial(): Promise<Result<AdminLogsInitialProjection>>;
}
