import { err, type Result } from '@/src/shared/application/result';
import type { DocsLogQueryGateway } from './docs-log-query-ports';
import type { DocsLogProjection } from './docs-log-query-types';

const isPositiveSafeInteger = (value: number): boolean => (
    Number.isSafeInteger(value) && value > 0
);

/** 문서 로그와 문서 이름을 함께 조회하는 애플리케이션 서비스입니다. */
export class GetDocsLogsService {
    constructor(private readonly gateway: DocsLogQueryGateway) {}

    async get(docsId: number): Promise<Result<DocsLogProjection>> {
        if (!isPositiveSafeInteger(docsId)) {
            return err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            });
        }

        const result = await this.gateway.loadByDocsId(docsId);
        if (!result.ok) return result;
        const projection = result.value;
        if (projection === null) {
            return err({
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            });
        }
        return result as Result<DocsLogProjection>;
    }
}
