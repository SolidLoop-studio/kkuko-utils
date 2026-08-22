import { ModerateDocsRequestsService } from '../../application/moderate-docs-requests';
import { SupabaseDocsRequestModerationGateway } from './supabase-docs-request-moderation-gateway';

export interface BrowserDocsServices {
    docsRequestModerationService: ModerateDocsRequestsService;
}

/** 브라우저 문서 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserDocsServices = (): BrowserDocsServices => ({
    docsRequestModerationService: new ModerateDocsRequestsService(
        new SupabaseDocsRequestModerationGateway(),
    ),
});
