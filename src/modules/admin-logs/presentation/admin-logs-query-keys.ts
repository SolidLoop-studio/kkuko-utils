import type { AdminLogsPageQuery } from '../application/admin-logs-page-query-types';

export const adminLogsQueryKeys = {
    pages: ['admin-logs', 'page'] as const,
    initial: ['admin-logs', 'initial'] as const,
    page: (query: AdminLogsPageQuery) => ['admin-logs', 'page', query] as const,
};
