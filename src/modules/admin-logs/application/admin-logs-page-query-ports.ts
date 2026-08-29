import type { Result } from '@/src/shared/application/result';
import type { AdminLogsPageProjection, AdminLogsPageQuery } from './admin-logs-page-query-types';

export interface AdminLogsPageQueryGateway {
    loadPage(query: AdminLogsPageQuery): Promise<Result<AdminLogsPageProjection>>;
}
