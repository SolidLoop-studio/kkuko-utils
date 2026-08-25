import type { Result } from '@/src/shared/application/result';
import type { DocsInfoProjection } from './docs-info-query-types';

export interface DocsInfoQueryGateway {
    loadByDocsId(docsId: number): Promise<Result<DocsInfoProjection | null>>;
}
