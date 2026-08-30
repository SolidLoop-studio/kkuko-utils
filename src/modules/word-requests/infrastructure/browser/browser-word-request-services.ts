import { ManageUserWordRequestsService } from '../../application/manage-user-word-requests';
import { GetPublicWordRequestPageService } from '../../application/get-public-word-request-page';
import { RequestWordThemeChangesService } from '../../application/request-word-theme-changes';
import { SupabasePublicWordRequestQueryGateway } from './supabase-public-word-request-query-gateway';
import { SupabaseUserWordRequestGateway } from './supabase-user-word-request-gateway';
import { SupabaseUserWordThemeRequestGateway } from './supabase-user-word-theme-request-gateway';

export interface BrowserWordRequestServices {
    publicWordRequestPageQueryService: GetPublicWordRequestPageService;
    userWordRequestService: ManageUserWordRequestsService;
    userWordThemeRequestService: RequestWordThemeChangesService;
}

/** 브라우저 단어 요청 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserWordRequestServices = (): BrowserWordRequestServices => ({
    publicWordRequestPageQueryService: new GetPublicWordRequestPageService(
        new SupabasePublicWordRequestQueryGateway(),
    ),
    userWordRequestService: new ManageUserWordRequestsService(
        new SupabaseUserWordRequestGateway(),
    ),
    userWordThemeRequestService: new RequestWordThemeChangesService(
        new SupabaseUserWordThemeRequestGateway(),
    ),
});
