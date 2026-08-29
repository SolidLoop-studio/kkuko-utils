export type { AdminDashboardQueryGateway } from './application/admin-dashboard-query-ports';
export type { AdminDashboardSummary } from './application/admin-dashboard-query-types';
export { GetAdminDashboardSummaryService } from './application/get-admin-dashboard-summary';
export {
    useAdminDashboardSummary,
    type AdminDashboardSummaryService,
} from './presentation/use-admin-dashboard-summary';
