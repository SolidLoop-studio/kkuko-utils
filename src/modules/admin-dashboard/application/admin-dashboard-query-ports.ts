import type { Result } from '@/src/shared/application/result';
import type { AdminDashboardSummary } from './admin-dashboard-query-types';

export interface AdminDashboardQueryGateway {
    loadSummary(): Promise<Result<AdminDashboardSummary>>;
}
