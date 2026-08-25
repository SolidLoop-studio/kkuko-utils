import { err, type Result } from '@/src/shared/application/result';
import type { DocsContentQueryGateway } from './docs-content-query-ports';
import type { DocsContentProjection } from './docs-content-query-types';

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

/** 문서 본문 화면에 필요한 단어와 메타데이터를 함께 조회합니다. */
export class GetDocsContentService {
    constructor(private readonly gateway: DocsContentQueryGateway) {}

    async get(docsId: number): Promise<Result<DocsContentProjection>> {
        if (!isPositiveSafeInteger(docsId)) {
            return err({ kind: 'validation', message: '올바른 문서 ID가 필요합니다.' });
        }

        const result = await this.gateway.loadByDocsId(docsId);
        if (!result.ok) return result;
        if (result.value === null) {
            return err({ kind: 'not-found', message: '문서를 찾을 수 없습니다.' });
        }
        return result as Result<DocsContentProjection>;
    }
}
