import { RunWordApprovalService } from '../../application/run-word-approval';
import { IndexedDbWordApprovalJobStore } from './word-approval-job-db';
import { SupabaseWordModerationGateway } from './supabase-word-moderation-gateway';

export interface BrowserWordModerationServices {
    wordApprovalService: RunWordApprovalService;
}

let browserWordModerationServices: BrowserWordModerationServices | null = null;

/** 브라우저에서 공유하는 단어 승인 서비스 조합을 반환한다. */
export const createBrowserWordModerationServices = (): BrowserWordModerationServices => {
    if (browserWordModerationServices === null) {
        browserWordModerationServices = {
            wordApprovalService: new RunWordApprovalService(
                new SupabaseWordModerationGateway(),
                new IndexedDbWordApprovalJobStore(),
            ),
        };
    }

    return browserWordModerationServices;
};
