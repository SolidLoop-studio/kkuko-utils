import { GetDocsListService } from '../../application/get-docs-list';
import { GetDocsLogsService } from '../../application/get-docs-logs';
import { GetDocsInfoService } from '../../application/get-docs-info';
import { GetDocsContentService } from '../../application/get-docs-content';
import { GetPendingDocsRequestsService } from '../../application/get-pending-docs-requests';
import { ModerateDocsRequestsService } from '../../application/moderate-docs-requests';
import { SupabaseDocsListQueryGateway } from './supabase-docs-list-query-gateway';
import { SupabaseDocsLogQueryGateway } from './supabase-docs-log-query-gateway';
import { SupabaseDocsInfoQueryGateway } from './supabase-docs-info-query-gateway';
import { SupabaseDocsContentQueryGateway } from './supabase-docs-content-query-gateway';
import { SupabaseDocsRequestModerationGateway } from './supabase-docs-request-moderation-gateway';
import { SupabaseDocsRequestQueryGateway } from './supabase-docs-request-query-gateway';

export interface BrowserDocsServices {
    docsListQueryService: GetDocsListService;
    docsLogsQueryService: GetDocsLogsService;
    docsInfoQueryService: GetDocsInfoService;
    docsContentQueryService: GetDocsContentService;
    docsRequestModerationService: ModerateDocsRequestsService;
    docsRequestQueryService: GetPendingDocsRequestsService;
}

/** 브라우저 문서 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserDocsServices = (): BrowserDocsServices => ({
    docsListQueryService: new GetDocsListService(
        new SupabaseDocsListQueryGateway(),
    ),
    docsLogsQueryService: new GetDocsLogsService(
        new SupabaseDocsLogQueryGateway(),
    ),
    docsInfoQueryService: new GetDocsInfoService(
        new SupabaseDocsInfoQueryGateway(),
    ),
    docsContentQueryService: new GetDocsContentService(
        new SupabaseDocsContentQueryGateway(),
    ),
    docsRequestModerationService: new ModerateDocsRequestsService(
        new SupabaseDocsRequestModerationGateway(),
    ),
    docsRequestQueryService: new GetPendingDocsRequestsService(
        new SupabaseDocsRequestQueryGateway(),
    ),
});
