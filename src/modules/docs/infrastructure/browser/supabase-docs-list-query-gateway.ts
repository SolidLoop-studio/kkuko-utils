import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsListQueryGateway } from '../../application/docs-list-query-ports';
import type { DocsSummary, DocsType } from '../../application/docs-list-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface DocsListQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): DocsListQueryBuilder;
    eq(column: 'is_hidden', value: boolean): DocsListQueryBuilder;
}

interface DocsListQueryClient {
    from(table: 'docs'): DocsListQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
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

const isDocsType = (value: unknown): value is DocsType => (
    value === 'letter' || value === 'theme' || value === 'ect'
);

const parseDocsSummary = (row: unknown): DocsSummary | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.name !== 'string'
        || typeof row.last_update !== 'string'
        || typeof row.created_at !== 'string'
        || !isDocsType(row.typez)) {
        return null;
    }

    const user = row.users;
    if (user !== null && !isRecord(user)) return null;
    const makerNickname = user === null ? null : user.nickname;
    if (!isNullableString(makerNickname)) return null;

    return {
        id: row.id,
        name: row.name,
        makerNickname,
        lastUpdatedAt: row.last_update,
        createdAt: row.created_at,
        type: row.typez,
    };
};

/** Supabase 문서 행을 목록 화면의 DTO로 투영합니다. */
export class SupabaseDocsListQueryGateway implements DocsListQueryGateway {
    constructor(
        private readonly client: DocsListQueryClient = browserSupabaseClient as unknown as DocsListQueryClient,
    ) {}

    async loadAll(): Promise<Result<DocsSummary[]>> {
        try {
            let query = this.client
                .from('docs')
                .select('id, name, typez, last_update, created_at, users(nickname)');
            if (process.env.NODE_ENV === 'production') {
                query = query.eq('is_hidden', false);
            }
            const response = await query;
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            const docs: DocsSummary[] = [];
            for (const row of response.data) {
                const docsSummary = parseDocsSummary(row);
                if (docsSummary === null) return err(infrastructureError());
                docs.push(docsSummary);
            }
            return ok(docs);
        } catch {
            return err(infrastructureError());
        }
    }
}
