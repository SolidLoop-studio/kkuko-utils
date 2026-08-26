import { GetCurrentUserProfileService } from '../../application/get-current-user-profile';
import { ManageAuthSessionService } from '../../application/manage-auth-session';
import { SupabaseAuthGateway } from './supabase-auth-gateway';
import { SupabaseCurrentUserProfileQueryGateway } from './supabase-current-user-profile-query-gateway';

export interface BrowserIdentityServices {
    authSessionService: ManageAuthSessionService;
    currentUserProfileQueryService: GetCurrentUserProfileService;
}

/** 브라우저 identity 기능에 필요한 작은 인증·프로필 서비스를 조합합니다. */
export const createBrowserIdentityServices = (): BrowserIdentityServices => ({
    authSessionService: new ManageAuthSessionService(new SupabaseAuthGateway()),
    currentUserProfileQueryService: new GetCurrentUserProfileService(
        new SupabaseCurrentUserProfileQueryGateway(),
    ),
});
