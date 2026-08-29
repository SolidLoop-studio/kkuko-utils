import { GetAdminLogsInitialService } from '../../application/get-admin-logs-initial';
import { GetAdminLogsPageService } from '../../application/get-admin-logs-page';
import { SupabaseAdminLogsInitialQueryGateway } from './supabase-admin-logs-initial-query-gateway';
import { SupabaseAdminLogsPageQueryGateway } from './supabase-admin-logs-page-query-gateway';

export interface BrowserAdminLogsServices {
    adminLogsInitialQueryService: GetAdminLogsInitialService;
    adminLogsPageQueryService: GetAdminLogsPageService;
}

/** 관리자 로그 브라우저 조회 의존성을 조합합니다. */
export const createBrowserAdminLogsServices = (): BrowserAdminLogsServices => ({
    adminLogsInitialQueryService: new GetAdminLogsInitialService(
        new SupabaseAdminLogsInitialQueryGateway(),
    ),
    adminLogsPageQueryService: new GetAdminLogsPageService(
        new SupabaseAdminLogsPageQueryGateway(),
    ),
});
