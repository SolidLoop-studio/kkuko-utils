import { GetDocsListService } from '../../application/get-docs-list';
import { GetDocsLogsService } from '../../application/get-docs-logs';
import { GetDocsInfoService } from '../../application/get-docs-info';
import { GetDocsContentService } from '../../application/get-docs-content';
import { GetPendingDocsRequestsService } from '../../application/get-pending-docs-requests';
import { ModerateDocsRequestsService } from '../../application/moderate-docs-requests';
import { CheckLetterDocsDuplicateService } from '../../application/check-letter-docs-duplicate';
import { RequestDocsCreationService } from '../../application/request-docs-creation';
import { RecordDocsViewService } from '../../application/record-docs-view';
import { SetDocsFavoriteService } from '../../application/set-docs-favorite';
import { SupabaseDocsListQueryGateway } from './supabase-docs-list-query-gateway';
import { SupabaseDocsLogQueryGateway } from './supabase-docs-log-query-gateway';
import { SupabaseDocsInfoQueryGateway } from './supabase-docs-info-query-gateway';
import { SupabaseDocsContentQueryGateway } from './supabase-docs-content-query-gateway';
import { SupabaseDocsRequestModerationGateway } from './supabase-docs-request-moderation-gateway';
import { SupabaseDocsRequestQueryGateway } from './supabase-docs-request-query-gateway';
import { SupabaseLetterDocsDuplicateQueryGateway } from './supabase-letter-docs-duplicate-query-gateway';
import { SupabaseDocsCreationRequestGateway } from './supabase-docs-creation-request-gateway';
import { SupabaseDocsViewCommandGateway } from './supabase-docs-view-command-gateway';
import { SupabaseDocsFavoriteCommandGateway } from './supabase-docs-favorite-command-gateway';

export interface BrowserDocsServices {
    docsListQueryService: GetDocsListService;
    docsLogsQueryService: GetDocsLogsService;
    docsInfoQueryService: GetDocsInfoService;
    docsContentQueryService: GetDocsContentService;
    docsRequestModerationService: ModerateDocsRequestsService;
    docsRequestQueryService: GetPendingDocsRequestsService;
    letterDocsDuplicateQueryService: CheckLetterDocsDuplicateService;
    docsCreationRequestService: RequestDocsCreationService;
    docsViewCommandService: RecordDocsViewService;
    docsFavoriteCommandService: SetDocsFavoriteService;
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
    letterDocsDuplicateQueryService: new CheckLetterDocsDuplicateService(
        new SupabaseLetterDocsDuplicateQueryGateway(),
    ),
    docsCreationRequestService: new RequestDocsCreationService(
        new SupabaseDocsCreationRequestGateway(),
    ),
    docsViewCommandService: new RecordDocsViewService(
        new SupabaseDocsViewCommandGateway(),
    ),
    docsFavoriteCommandService: new SetDocsFavoriteService(
        new SupabaseDocsFavoriteCommandGateway(),
    ),
});
