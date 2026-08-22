import type {
    ApproveDocsRequestSelection,
    ApproveDocsRequestsCommand,
    RejectDocsRequestsCommand,
} from '@/src/modules/docs/domain/docs-request-moderation';

export type {
    ApproveDocsRequestSelection,
    ApproveDocsRequestsCommand,
    RejectDocsRequestsCommand,
};

export type DocsRequestModerationResult = {
    processedRequestIds: number[];
    processedRequestCount: number;
};
