import type { WordLogPageQuery } from '../application/word-log-query-types';

export const wordLogQueryKeys = {
    pages: ['word-logs', 'page'] as const,
    page: (query: WordLogPageQuery) => ['word-logs', 'page', query] as const,
};
