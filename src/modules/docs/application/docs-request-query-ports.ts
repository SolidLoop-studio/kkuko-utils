import type { Result } from '@/src/shared/application/result';
import type { PendingDocsRequest } from './docs-request-query-types';

export interface DocsRequestQueryGateway {
    loadPending(): Promise<Result<PendingDocsRequest[]>>;
}
