import type { Result } from '@/src/shared/application/result';
import type {
    ApproveDocsRequestsCommand,
    DocsRequestModerationResult,
    RejectDocsRequestsCommand,
} from './docs-request-moderation-types';

export interface DocsRequestModerationGateway {
    approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
    reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>>;
}
