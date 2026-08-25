import type { Result } from '@/src/shared/application/result';
import type { DocsListQueryGateway } from './docs-list-query-ports';
import type { DocsSummary } from './docs-list-query-types';

/** 문서 목록을 조회하는 애플리케이션 서비스입니다. */
export class GetDocsListService {
    constructor(private readonly gateway: DocsListQueryGateway) {}

    get(): Promise<Result<DocsSummary[]>> {
        return this.gateway.loadAll();
    }
}
