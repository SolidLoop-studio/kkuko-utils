import { err, ok, type Result } from '@/src/shared/application/result';
import type { DocsMarkerQueryGateway } from './docs-marker-query-ports';
import type { DocsMarkerSlot } from './docs-marker-query-types';

const isPositiveSafeInteger = (value: number): boolean => (
    Number.isSafeInteger(value) && value > 0
);

/** 미션 글자 상위 문서의 marker projection을 조회합니다. */
export class GetDocsMarkersService {
    constructor(private readonly gateway: DocsMarkerQueryGateway) {}

    async get(parentDocsId: number): Promise<Result<DocsMarkerSlot[]>> {
        if (!isPositiveSafeInteger(parentDocsId)) {
            return err({
                kind: 'validation',
                message: '올바른 문서 ID가 필요합니다.',
            });
        }

        const result = await this.gateway.loadByParentDocsId(parentDocsId);
        if (!result.ok) return result;
        if (result.value === null) {
            return err({
                kind: 'not-found',
                message: '문서를 찾을 수 없습니다.',
            });
        }
        return ok(result.value);
    }
}
