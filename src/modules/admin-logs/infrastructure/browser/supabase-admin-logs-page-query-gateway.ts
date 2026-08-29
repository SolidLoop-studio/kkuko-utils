import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { AdminLogsPageQueryGateway } from '../../application/admin-logs-page-query-ports';
import type {
    AdminDocsLogsPageProjection,
    AdminLogsPageProjection,
    AdminLogsPageQuery,
    AdminWordLogsPageProjection,
} from '../../application/admin-logs-page-query-types';
import type {
    AdminDocsLogEntry,
    AdminWordLogEntry,
} from '../../application/admin-logs-initial-query-types';

interface QueryResponse {
    data?: unknown;
    count?: unknown;
    error?: unknown;
}

interface PageQuery extends PromiseLike<QueryResponse> {
    order(column: string, options: { ascending: false }): PageQuery;
    eq(column: string, value: string): PageQuery;
    gte(column: string, value: string): PageQuery;
    lte(column: string, value: string): PageQuery;
    range(from: number, to: number): PageQuery;
}

interface PageQueryBuilder {
    select(columns: string, options: { count: 'exact' }): PageQuery;
}

interface AdminLogsPageQueryClient {
    from(table: 'logs' | 'docs_logs'): PageQueryBuilder;
}

const publicInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isNullableString = (value: unknown): value is string | null => (
    typeof value === 'string' || value === null
);

const readNullableNickname = (relation: unknown): string | null | undefined => {
    if (relation === null) return null;
    if (!isRecord(relation) || !isNullableString(relation.nickname)) return undefined;
    return relation.nickname;
};

const isWordLogState = (value: unknown): value is AdminWordLogEntry['state'] => (
    value === 'approved' || value === 'rejected' || value === 'pending'
);

const isMutationType = (
    value: unknown,
): value is AdminWordLogEntry['requestType'] | AdminDocsLogEntry['type'] => (
    value === 'add' || value === 'delete'
);

const parseWordLog = (row: unknown): AdminWordLogEntry | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.word !== 'string'
        || !isWordLogState(row.state)
        || !isMutationType(row.r_type)
        || typeof row.created_at !== 'string') {
        return null;
    }

    const requesterNickname = readNullableNickname(row.make_by_user);
    const processorNickname = readNullableNickname(row.processed_by_user);
    if (requesterNickname === undefined || processorNickname === undefined) return null;

    return {
        id: row.id,
        word: row.word,
        state: row.state,
        requestType: row.r_type,
        requesterNickname,
        processorNickname,
        createdAt: row.created_at,
    };
};

const parseDocumentName = (relation: unknown): string | null | undefined => {
    if (relation === null) return null;
    if (!isRecord(relation) || typeof relation.name !== 'string') return undefined;
    return relation.name;
};

const parseDocsLog = (row: unknown): AdminDocsLogEntry | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.word !== 'string'
        || !isMutationType(row.type)
        || typeof row.date !== 'string') {
        return null;
    }

    const documentName = parseDocumentName(row.docs);
    const actorNickname = readNullableNickname(row.users);
    if (documentName === undefined || actorNickname === undefined) return null;

    return {
        id: row.id,
        word: row.word,
        documentName,
        actorNickname,
        type: row.type,
        occurredAt: row.date,
    };
};

const parseRows = <T>(rows: unknown, parse: (row: unknown) => T | null): T[] | null => {
    if (!Array.isArray(rows)) return null;
    const parsed: T[] = [];
    for (const row of rows) {
        const value = parse(row);
        if (value === null) return null;
        parsed.push(value);
    }
    return parsed;
};

const parsePageResponse = <T>(
    response: unknown,
    parse: (row: unknown) => T | null,
): { items: T[]; totalCount: number } | null => {
    if (!isRecord(response) || response.error !== null || !isNonNegativeSafeInteger(response.count)) {
        return null;
    }

    const items = parseRows(response.data, parse);
    if (items === null) return null;
    return { items, totalCount: response.count };
};

const applyDateBounds = (query: PageQuery, fromDate?: string, toDate?: string): PageQuery => {
    let filteredQuery = query;
    if (fromDate !== undefined) filteredQuery = filteredQuery.gte('created_at', fromDate);
    if (toDate !== undefined) filteredQuery = filteredQuery.lte('created_at', toDate);
    return filteredQuery;
};

/** Supabase 관리자 로그 행을 필터된 페이지 projection으로 안전하게 투영합니다. */
export class SupabaseAdminLogsPageQueryGateway implements AdminLogsPageQueryGateway {
    constructor(
        private readonly client: AdminLogsPageQueryClient = (
            browserSupabaseClient as unknown as AdminLogsPageQueryClient
        ),
    ) {}

    async loadPage(query: AdminLogsPageQuery): Promise<Result<AdminLogsPageProjection>> {
        try {
            if (query.filter.kind === 'word') return await this.loadWordPage(query);
            return await this.loadDocsPage(query);
        } catch {
            return err(publicInfrastructureError());
        }
    }

    private async loadWordPage(query: AdminLogsPageQuery): Promise<Result<AdminWordLogsPageProjection>> {
        let request = this.client
            .from('logs')
            .select('id, word, state, r_type, created_at, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (query.filter.kind !== 'word') return err(publicInfrastructureError());
        if (query.filter.state !== 'all') request = request.eq('state', query.filter.state);
        if (query.filter.requestType !== 'all') request = request.eq('r_type', query.filter.requestType);
        request = applyDateBounds(request, query.fromDate, query.toDate);

        const response = await request.range(
            (query.page - 1) * query.pageSize,
            query.page * query.pageSize - 1,
        );
        const page = parsePageResponse(response, parseWordLog);
        if (page === null) return err(publicInfrastructureError());

        return ok({
            kind: 'word',
            items: page.items,
            totalCount: page.totalCount,
            page: query.page,
            pageSize: query.pageSize,
        });
    }

    private async loadDocsPage(query: AdminLogsPageQuery): Promise<Result<AdminDocsLogsPageProjection>> {
        if (query.filter.kind !== 'docs') return err(publicInfrastructureError());
        const documentName = query.filter.documentName;
        let request = this.client
            .from('docs_logs')
            .select(
                documentName !== undefined
                    ? 'id, word, type, date, docs!inner(name), users(nickname)'
                    : 'id, word, type, date, docs(name), users(nickname)',
                { count: 'exact' },
            )
            .order('date', { ascending: false });

        if (documentName !== undefined) request = request.eq('docs.name', documentName);
        if (query.filter.type !== 'all') request = request.eq('type', query.filter.type);
        if (query.fromDate !== undefined) request = request.gte('date', query.fromDate);
        if (query.toDate !== undefined) request = request.lte('date', query.toDate);

        const response = await request.range(
            (query.page - 1) * query.pageSize,
            query.page * query.pageSize - 1,
        );
        const page = parsePageResponse(response, parseDocsLog);
        if (page === null) return err(publicInfrastructureError());

        return ok({
            kind: 'docs',
            items: page.items,
            totalCount: page.totalCount,
            page: query.page,
            pageSize: query.pageSize,
        });
    }
}
