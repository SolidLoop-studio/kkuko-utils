import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { AdminLogsInitialQueryGateway } from '../../application/admin-logs-initial-query-ports';
import type {
    AdminLogsDocumentChoice,
    AdminLogsDocumentType,
    AdminLogsInitialProjection,
} from '../../application/admin-logs-initial-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface DocumentChoiceQuery extends PromiseLike<QueryResponse> {
    eq(column: 'is_hidden', value: false): DocumentChoiceQuery;
}

interface DocumentChoiceQueryBuilder {
    select(columns: 'id, name, typez'): DocumentChoiceQuery;
}

interface AdminLogsQueryClient {
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

const isDocumentType = (value: unknown): value is AdminLogsDocumentType => (
    value === 'letter' || value === 'theme' || value === 'ect'
);

const parseDocumentChoice = (row: unknown): AdminLogsDocumentChoice | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.name !== 'string'
        || !isDocumentType(row.typez)) {
        return null;
    }

    return { id: row.id, name: row.name, type: row.typez };
};

const parseDocumentChoices = (rows: unknown): AdminLogsDocumentChoice[] | null => {
    if (!Array.isArray(rows)) return null;
    const documentChoices: AdminLogsDocumentChoice[] = [];
    for (const row of rows) {
        const documentChoice = parseDocumentChoice(row);
        if (documentChoice === null) return null;
        documentChoices.push(documentChoice);
    }
    return documentChoices;
};

/** Supabase 문서 행을 관리자 로그 초기 선택지 projection으로 투영합니다. */
export class SupabaseAdminLogsInitialQueryGateway implements AdminLogsInitialQueryGateway {
    constructor(
        private readonly client: AdminLogsQueryClient = (
            browserSupabaseClient as unknown as AdminLogsQueryClient
        ),
        private readonly isProduction = process.env.NODE_ENV === 'production',
    ) {}

    async loadInitial(): Promise<Result<AdminLogsInitialProjection>> {
        try {
            let documentChoicesQuery = this.client
                .from('docs')
                .select('id, name, typez');
            if (this.isProduction) {
                documentChoicesQuery = documentChoicesQuery.eq('is_hidden', false);
            }

            const response = await documentChoicesQuery;
            if (!isRecord(response) || response.error !== null) {
                return err(adminLogsInitialError());
            }

            const documentChoices = parseDocumentChoices(response.data);
            if (documentChoices === null) return err(adminLogsInitialError());

            return ok({ documentChoices });
        } catch {
            return err(adminLogsInitialError());
        }
    }
}
