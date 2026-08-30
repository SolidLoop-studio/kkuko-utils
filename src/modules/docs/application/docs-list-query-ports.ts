import type { Result } from '@/src/shared/application/result';
import type { DocsSummary } from './docs-list-query-types';

export interface DocsListQueryGateway {
    loadAll(): Promise<Result<DocsSummary[]>>;
}
