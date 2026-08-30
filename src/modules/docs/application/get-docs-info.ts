import { err, type Result } from '@/src/shared/application/result';
import type { DocsInfoQueryGateway } from './docs-info-query-ports';
import type { DocsInfoProjection } from './docs-info-query-types';

const isPositiveSafeInteger = (value: number): boolean => (
    Number.isSafeInteger(value) && value > 0
);

/** 문서 정보와 집계 값을 함께 조회하는 애플리케이션 서비스입니다. */
export class GetDocsInfoService {
    constructor(private readonly gateway: DocsInfoQueryGateway) {}

    async get(docsId: number): Promise<Result<DocsInfoProjection>> {
        if (!isPositiveSafeInteger(docsId)) {
            return err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            });
        }

        const result = await this.gateway.loadByDocsId(docsId);
        if (!result.ok) return result;
        if (result.value === null) {
            return err({
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            });
        }
        return result as Result<DocsInfoProjection>;
    }
}
