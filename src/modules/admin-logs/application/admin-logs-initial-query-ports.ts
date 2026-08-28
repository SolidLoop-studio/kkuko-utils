import type { Result } from '@/src/shared/application/result';
import type { AdminLogsInitialProjection } from './admin-logs-initial-query-types';

export interface AdminLogsInitialQueryGateway {
    loadInitial(): Promise<Result<AdminLogsInitialProjection>>;
}
