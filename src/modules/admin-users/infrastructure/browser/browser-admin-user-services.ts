import { GetAdminUserListService } from '../../application/get-admin-user-list';
import { SupabaseAdminUserListQueryGateway } from './supabase-admin-user-list-query-gateway';

export interface BrowserAdminUserServices {
    adminUserListService: GetAdminUserListService;
}

/** 관리자 사용자 목록 브라우저 조회 의존성을 조합합니다. */
export const createBrowserAdminUserServices = (): BrowserAdminUserServices => ({
    adminUserListService: new GetAdminUserListService(
        new SupabaseAdminUserListQueryGateway(),
    ),
});
