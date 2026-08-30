import type { Result } from '@/src/shared/application/result';
import type { WordLogPageProjection, WordLogPageQuery } from './word-log-query-types';

export interface WordLogQueryGateway {
    loadPage(query: WordLogPageQuery): Promise<Result<WordLogPageProjection>>;
}
