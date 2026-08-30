import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { DocsRequestQueryGateway } from '../../application/docs-request-query-ports';
import type { PendingDocsRequest } from '../../application/docs-request-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface DocsRequestQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): DocsRequestQueryBuilder;
}

interface DocsRequestQueryClient {
    from(table: 'docs_wait'): DocsRequestQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 요청 목록을 불러오는 중 오류가 발생했습니다.',
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

const parsePendingDocsRequest = (row: unknown): PendingDocsRequest | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.req_at !== 'string'
        || typeof row.docs_name !== 'string'
        || !isNullableString(row.req_by)) {
        return null;
    }

    const user = row.users;
    if (user !== null && !isRecord(user)) {
        return null;
    }
    const requesterNickname = user === null ? null : user.nickname;
    if (!isNullableString(requesterNickname)) return null;

    return {
        id: row.id,
        requestedAt: row.req_at,
        docsName: row.docs_name,
        requesterNickname,
        requesterId: row.req_by,
    };
};

/** Supabase의 대기 문서 요청 행을 목록 조회 DTO로 투영합니다. */
export class SupabaseDocsRequestQueryGateway implements DocsRequestQueryGateway {
    constructor(
        private readonly client: DocsRequestQueryClient = browserSupabaseClient as unknown as DocsRequestQueryClient,
    ) {}

    async loadPending(): Promise<Result<PendingDocsRequest[]>> {
        try {
            const response = await this.client
                .from('docs_wait')
                .select('id, req_at, docs_name, req_by, users(nickname)');
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            const requests: PendingDocsRequest[] = [];
            for (const row of response.data) {
                const request = parsePendingDocsRequest(row);
                if (request === null) return err(infrastructureError());
                requests.push(request);
            }
            return ok(requests);
        } catch {
            return err(infrastructureError());
        }
    }
}
