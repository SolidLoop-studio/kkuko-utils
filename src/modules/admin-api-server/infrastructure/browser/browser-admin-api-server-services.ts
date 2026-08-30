import { AdminApiServerService } from '../../application/admin-api-server-service';
import { AxiosAdminApiServerGateway } from './axios-admin-api-server-gateway';
import { SupabaseAdminAccessTokenProvider } from './supabase-admin-access-token-provider';

export interface BrowserAdminApiServerServices { adminApiServerService: AdminApiServerService; }

/** 브라우저 관리자 API 의존성을 한 곳에서 조합합니다. */
export const createBrowserAdminApiServerServices = (): BrowserAdminApiServerServices => ({
    adminApiServerService: new AdminApiServerService(
        new AxiosAdminApiServerGateway(axios, new SupabaseAdminAccessTokenProvider()),
    ),
});
import axios from 'axios';
