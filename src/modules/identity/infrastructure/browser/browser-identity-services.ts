import { CheckNicknameAvailabilityService } from '../../application/check-nickname-availability';
import { GetCurrentUserProfileService } from '../../application/get-current-user-profile';
import { GetProfileSummaryService } from '../../application/get-profile-summary';
import { GetProfileFavoriteDocsService } from '../../application/get-profile-favorite-docs';
import { ManageAuthSessionService } from '../../application/manage-auth-session';
import { RegisterNicknameService } from '../../application/register-nickname';
import { SearchProfilesByNicknameService } from '../../application/search-profiles-by-nickname';
import { SupabaseAuthGateway } from './supabase-auth-gateway';
import { SupabaseCurrentUserProfileQueryGateway } from './supabase-current-user-profile-query-gateway';
import { SupabaseNicknameCommandGateway } from './supabase-nickname-command-gateway';
import { SupabaseNicknameQueryGateway } from './supabase-nickname-query-gateway';
import { SupabaseProfileSearchQueryGateway } from './supabase-profile-search-query-gateway';
import { SupabaseProfileSummaryQueryGateway } from './supabase-profile-summary-query-gateway';
import { SupabaseProfileFavoriteDocsQueryGateway } from './supabase-profile-favorite-docs-query-gateway';

export interface BrowserIdentityServices {
    authSessionService: ManageAuthSessionService;
    checkNicknameAvailabilityService: CheckNicknameAvailabilityService;
    currentUserProfileQueryService: GetCurrentUserProfileService;
    profileSearchQueryService: SearchProfilesByNicknameService;
    profileSummaryQueryService: GetProfileSummaryService;
    profileFavoriteDocsQueryService: GetProfileFavoriteDocsService;
    registerNicknameService: RegisterNicknameService;
}

/** 브라우저 identity 기능에 필요한 작은 인증·프로필·닉네임 서비스를 조합합니다. */
export const createBrowserIdentityServices = (): BrowserIdentityServices => ({
    authSessionService: new ManageAuthSessionService(new SupabaseAuthGateway()),
    checkNicknameAvailabilityService: new CheckNicknameAvailabilityService(
        new SupabaseNicknameQueryGateway(),
    ),
    currentUserProfileQueryService: new GetCurrentUserProfileService(
        new SupabaseCurrentUserProfileQueryGateway(),
    ),
    profileSearchQueryService: new SearchProfilesByNicknameService(
        new SupabaseProfileSearchQueryGateway(),
    ),
    profileSummaryQueryService: new GetProfileSummaryService(
        new SupabaseProfileSummaryQueryGateway(),
    ),
    profileFavoriteDocsQueryService: new GetProfileFavoriteDocsService(
        new SupabaseProfileFavoriteDocsQueryGateway(),
    ),
    registerNicknameService: new RegisterNicknameService(new SupabaseNicknameCommandGateway()),
});
