import { GetAdminDashboardSummaryService } from '../../application/get-admin-dashboard-summary';
import { SupabaseAdminDashboardQueryGateway } from './supabase-admin-dashboard-query-gateway';

export interface BrowserAdminDashboardServices {
    adminDashboardSummaryService: GetAdminDashboardSummaryService;
}

/** 관리자 대시보드의 브라우저 조회 의존성을 조합합니다. */
export const createBrowserAdminDashboardServices = (): BrowserAdminDashboardServices => ({
    adminDashboardSummaryService: new GetAdminDashboardSummaryService(
        new SupabaseAdminDashboardQueryGateway(),
    ),
});
