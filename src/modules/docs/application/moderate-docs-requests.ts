import type { Result } from '@/src/shared/application/result';
import {
    normalizeApproveDocsRequestsCommand,
    normalizeRejectDocsRequestsCommand,
} from '@/src/modules/docs/domain/docs-request-moderation';
import type { DocsRequestModerationGateway } from './docs-request-moderation-ports';
import type {
    ApproveDocsRequestsCommand,
    DocsRequestModerationResult,
    RejectDocsRequestsCommand,
} from './docs-request-moderation-types';

/** 문서 요청을 승인하거나 거부하는 애플리케이션 서비스입니다. */
export class ModerateDocsRequestsService {
    constructor(private readonly gateway: DocsRequestModerationGateway) {}

    async approve(
        command: ApproveDocsRequestsCommand,
    ): Promise<Result<DocsRequestModerationResult>> {
        const normalized = normalizeApproveDocsRequestsCommand(command);
        return normalized.ok ? this.gateway.approve(normalized.value) : normalized;
    }

    async reject(
        command: RejectDocsRequestsCommand,
    ): Promise<Result<DocsRequestModerationResult>> {
        const normalized = normalizeRejectDocsRequestsCommand(command);
        return normalized.ok ? this.gateway.reject(normalized.value) : normalized;
    }
}
