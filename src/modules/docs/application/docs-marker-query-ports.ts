import type { Result } from '@/src/shared/application/result';
import type { DocsMarkerSlot } from './docs-marker-query-types';

/** 미션 글자 상위 문서로 하위 marker를 조회하는 포트입니다. */
export interface DocsMarkerQueryGateway {
    loadByParentDocsId(parentDocsId: number): Promise<Result<DocsMarkerSlot[] | null>>;
}
