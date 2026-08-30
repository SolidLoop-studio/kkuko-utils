import type { Result } from '@/src/shared/application/result';
import type { DocsLogProjection } from './docs-log-query-types';

export interface DocsLogQueryGateway {
    loadByDocsId(docsId: number): Promise<Result<DocsLogProjection | null>>;
}
