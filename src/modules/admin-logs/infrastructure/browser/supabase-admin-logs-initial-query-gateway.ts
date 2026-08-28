import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { AdminLogsInitialQueryGateway } from '../../application/admin-logs-initial-query-ports';
import type {
    AdminDocsLogEntry,
    AdminLogsDocumentChoice,
    AdminLogsDocumentType,
    AdminLogsInitialProjection,
    AdminWordLogEntry,
} from '../../application/admin-logs-initial-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface RangeQuery extends PromiseLike<QueryResponse> {
    range(from: 0, to: 999): PromiseLike<QueryResponse>;
}

interface OrderQuery {
    order(column: string, options: { ascending: false }): RangeQuery;
}

interface LogQueryBuilder {
    select(columns: string): OrderQuery;
}

interface DocumentChoiceQuery extends PromiseLike<QueryResponse> {
    eq(column: 'is_hidden', value: false): DocumentChoiceQuery;
}

interface DocumentChoiceQueryBuilder {
    select(columns: 'id, name, typez'): DocumentChoiceQuery;
}

interface AdminLogsQueryClient {
    from(table: 'logs' | 'docs_logs'): LogQueryBuilder;
    from(table: 'docs'): DocumentChoiceQueryBuilder;
}

const adminLogsInitialError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
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

const isDocumentType = (value: unknown): value is AdminLogsDocumentType => (
    value === 'letter' || value === 'theme' || value === 'ect'
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

const parseDocumentChoice = (row: unknown): AdminLogsDocumentChoice | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.name !== 'string'
        || !isDocumentType(row.typez)) {
        return null;
    }

    return { id: row.id, name: row.name, type: row.typez };
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

/** Supabase 로그·문서 행을 관리자 초기 화면의 좁은 projection으로 투영합니다. */
export class SupabaseAdminLogsInitialQueryGateway implements AdminLogsInitialQueryGateway {
    constructor(
        private readonly client: AdminLogsQueryClient = (
            browserSupabaseClient as unknown as AdminLogsQueryClient
        ),
        private readonly isProduction = process.env.NODE_ENV === 'production',
    ) {}

    async loadInitial(): Promise<Result<AdminLogsInitialProjection>> {
        try {
            const wordLogsQuery = this.client
                .from('logs')
                .select('id, word, state, r_type, created_at, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)')
                .order('created_at', { ascending: false })
                .range(0, 999);
            const docsLogsQuery = this.client
                .from('docs_logs')
                .select('id, word, type, date, docs(name), users(nickname)')
                .order('date', { ascending: false })
                .range(0, 999);
            let documentChoicesQuery = this.client
                .from('docs')
                .select('id, name, typez');
            if (this.isProduction) {
                documentChoicesQuery = documentChoicesQuery.eq('is_hidden', false);
            }

            const [wordLogsResponse, docsLogsResponse, documentChoicesResponse] = await Promise.all([
                wordLogsQuery,
                docsLogsQuery,
                documentChoicesQuery,
            ]);
            if (!isRecord(wordLogsResponse)
                || wordLogsResponse.error !== null
                || !isRecord(docsLogsResponse)
                || docsLogsResponse.error !== null
                || !isRecord(documentChoicesResponse)
                || documentChoicesResponse.error !== null) {
                return err(adminLogsInitialError());
            }

            const wordLogs = parseRows(wordLogsResponse.data, parseWordLog);
            const docsLogs = parseRows(docsLogsResponse.data, parseDocsLog);
            const documentChoices = parseRows(documentChoicesResponse.data, parseDocumentChoice);
            if (wordLogs === null || docsLogs === null || documentChoices === null) {
                return err(adminLogsInitialError());
            }

            return ok({ wordLogs, docsLogs, documentChoices });
        } catch {
            return err(adminLogsInitialError());
        }
    }
}
