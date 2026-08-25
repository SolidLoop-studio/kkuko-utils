import { GetDocsListService } from '../../application/get-docs-list';
import { GetPendingDocsRequestsService } from '../../application/get-pending-docs-requests';
import { ModerateDocsRequestsService } from '../../application/moderate-docs-requests';
import { SupabaseDocsListQueryGateway } from './supabase-docs-list-query-gateway';
import { SupabaseDocsRequestModerationGateway } from './supabase-docs-request-moderation-gateway';
import { SupabaseDocsRequestQueryGateway } from './supabase-docs-request-query-gateway';

export interface BrowserDocsServices {
    docsListQueryService: GetDocsListService;
    docsRequestModerationService: ModerateDocsRequestsService;
    docsRequestQueryService: GetPendingDocsRequestsService;
}

/** 브라우저 문서 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserDocsServices = (): BrowserDocsServices => ({
    docsListQueryService: new GetDocsListService(
        new SupabaseDocsListQueryGateway(),
    ),
    docsRequestModerationService: new ModerateDocsRequestsService(
        new SupabaseDocsRequestModerationGateway(),
    ),
    docsRequestQueryService: new GetPendingDocsRequestsService(
        new SupabaseDocsRequestQueryGateway(),
    ),
});
