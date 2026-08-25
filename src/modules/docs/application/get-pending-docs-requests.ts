import type { Result } from '@/src/shared/application/result';
import type { DocsRequestQueryGateway } from './docs-request-query-ports';
import type { PendingDocsRequest } from './docs-request-query-types';

/** 대기 중인 문서 요청 목록을 조회하는 애플리케이션 서비스입니다. */
export class GetPendingDocsRequestsService {
    constructor(private readonly gateway: DocsRequestQueryGateway) {}

    get(): Promise<Result<PendingDocsRequest[]>> {
        return this.gateway.loadPending();
    }
}
