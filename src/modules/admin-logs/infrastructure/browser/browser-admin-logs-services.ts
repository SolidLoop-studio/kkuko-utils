import { GetAdminLogsInitialService } from '../../application/get-admin-logs-initial';
import { SupabaseAdminLogsInitialQueryGateway } from './supabase-admin-logs-initial-query-gateway';

export interface BrowserAdminLogsServices {
    adminLogsInitialQueryService: GetAdminLogsInitialService;
}

/** 관리자 로그 브라우저 조회 의존성을 조합합니다. */
export const createBrowserAdminLogsServices = (): BrowserAdminLogsServices => ({
    adminLogsInitialQueryService: new GetAdminLogsInitialService(
        new SupabaseAdminLogsInitialQueryGateway(),
    ),
});
