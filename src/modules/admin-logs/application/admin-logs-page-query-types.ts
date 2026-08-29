import type {
    AdminDocsLogEntry,
    AdminLogMutationType,
    AdminWordLogEntry,
    AdminWordLogState,
} from './admin-logs-initial-query-types';

export interface AdminLogsWordPageFilter {
    kind: 'word';
    state: AdminWordLogState | 'all';
    requestType: AdminLogMutationType | 'all';
}

export interface AdminLogsDocsPageFilter {
    kind: 'docs';
    documentName?: string;
    type: AdminLogMutationType | 'all';
}

export interface AdminLogsPageQuery {
    page: number;
    pageSize: 30 | 150;
    fromDate?: string;
    toDate?: string;
    filter: AdminLogsWordPageFilter | AdminLogsDocsPageFilter;
}

interface AdminLogsPageMetadata {
    totalCount: number;
    page: number;
    pageSize: 30 | 150;
}

export interface AdminWordLogsPageProjection extends AdminLogsPageMetadata {
    kind: 'word';
    items: AdminWordLogEntry[];
}

export interface AdminDocsLogsPageProjection extends AdminLogsPageMetadata {
    kind: 'docs';
    items: AdminDocsLogEntry[];
}

export type AdminLogsPageProjection = AdminWordLogsPageProjection | AdminDocsLogsPageProjection;
