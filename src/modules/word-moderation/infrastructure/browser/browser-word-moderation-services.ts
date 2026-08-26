import { RunWordApprovalService } from '../../application/run-word-approval';
import { RunWordDeletionService } from '../../application/run-word-deletion';
import { ModerateWordRequestsService } from '../../application/moderate-word-requests';
import { GetDocsWordMutationTargetsService } from '../../application/get-docs-word-mutation-targets';
import { DeleteWordDirectlyService } from '../../application/delete-word-directly';
import { GetPendingWordModerationRequestsService } from '../../application/get-pending-word-moderation-requests';
import { IndexedDbWordApprovalJobStore } from './word-approval-job-db';
import { IndexedDbWordDeletionJobStore } from './word-deletion-job-db';
import { SupabaseDocsWordModerationGateway } from './supabase-docs-word-moderation-gateway';
import { SupabaseWordDeletionGateway } from './supabase-word-deletion-gateway';
import { SupabaseWordModerationGateway } from './supabase-word-moderation-gateway';
import { SupabaseWordRequestModerationGateway } from './supabase-word-request-moderation-gateway';
import { SupabasePendingWordModerationQueryGateway } from './supabase-pending-word-moderation-query-gateway';

export interface BrowserWordModerationServices {
    wordApprovalService: RunWordApprovalService;
    wordDeletionService: RunWordDeletionService;
    wordRequestModerationService: ModerateWordRequestsService;
    docsWordMutationTargetService: GetDocsWordMutationTargetsService;
    directWordDeletionService: DeleteWordDirectlyService;
    pendingWordModerationQueryService: GetPendingWordModerationRequestsService;
}

let browserWordModerationServices: BrowserWordModerationServices | null = null;

/** 브라우저에서 공유하는 단어 승인 서비스 조합을 반환한다. */
export const createBrowserWordModerationServices = (): BrowserWordModerationServices => {
    if (browserWordModerationServices === null) {
        const docsGateway = new SupabaseDocsWordModerationGateway();
        browserWordModerationServices = {
            wordApprovalService: new RunWordApprovalService(
                new SupabaseWordModerationGateway(),
                new IndexedDbWordApprovalJobStore(),
            ),
            wordDeletionService: new RunWordDeletionService(
                new SupabaseWordDeletionGateway(),
                new IndexedDbWordDeletionJobStore(),
            ),
            wordRequestModerationService: new ModerateWordRequestsService(
                new SupabaseWordRequestModerationGateway(),
            ),
            docsWordMutationTargetService: new GetDocsWordMutationTargetsService(docsGateway),
            directWordDeletionService: new DeleteWordDirectlyService(docsGateway),
            pendingWordModerationQueryService: new GetPendingWordModerationRequestsService(
                new SupabasePendingWordModerationQueryGateway(),
            ),
        };
    }

    return browserWordModerationServices;
};
