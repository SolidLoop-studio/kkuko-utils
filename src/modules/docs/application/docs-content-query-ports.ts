import type { Result } from '@/src/shared/application/result';
import type { DocsContentProjection } from './docs-content-query-types';

export interface DocsContentQueryGateway {
    loadByDocsId(docsId: number): Promise<Result<DocsContentProjection | null>>;
}
