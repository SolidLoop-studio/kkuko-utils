import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { ProfileProcessedRequestsQueryGateway } from '../../application/profile-processed-requests-query-ports';
import type { ProfileProcessedRequest } from '../../application/profile-processed-requests-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface ProcessedRequestsQueryLimit {
    limit(count: 30): PromiseLike<QueryResponse>;
}

interface ProcessedRequestsQueryOrder {
    order(column: 'created_at', options: { ascending: false }): ProcessedRequestsQueryLimit;
}

interface ProcessedRequestsQueryFilter {
    eq(column: 'make_by', value: string): ProcessedRequestsQueryOrder;
}

interface ProcessedRequestsQueryBuilder {
    select(columns: 'id, word, created_at, state, r_type'): ProcessedRequestsQueryFilter;
}

interface ProfileProcessedRequestsQueryClient {
    from(table: 'logs'): ProcessedRequestsQueryBuilder;
}

const profileProcessedRequestsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '처리된 요청을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isRequestType = (value: unknown): value is ProfileProcessedRequest['requestType'] => (
    value === 'add' || value === 'delete'
);

const isRequestState = (value: unknown): value is ProfileProcessedRequest['state'] => (
    value === 'pending' || value === 'approved' || value === 'rejected'
);

const parseProcessedRequest = (row: unknown): ProfileProcessedRequest | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.word !== 'string'
        || typeof row.created_at !== 'string'
        || !isRequestState(row.state)
        || !isRequestType(row.r_type)) {
        return null;
    }

    return {
        id: row.id,
        word: row.word,
        createdAt: row.created_at,
        state: row.state,
        requestType: row.r_type,
    };
};

/** Supabase 처리 요청 행을 프로필 활동 tab의 좁은 DTO로 투영합니다. */
export class SupabaseProfileProcessedRequestsQueryGateway implements ProfileProcessedRequestsQueryGateway {
    constructor(
        private readonly client: ProfileProcessedRequestsQueryClient = (
            browserSupabaseClient as unknown as ProfileProcessedRequestsQueryClient
        ),
    ) {}

    async loadByMakerId(userId: string): Promise<Result<ProfileProcessedRequest[]>> {
        try {
            const response = await this.client
                .from('logs')
                .select('id, word, created_at, state, r_type')
                .eq('make_by', userId)
                .order('created_at', { ascending: false })
                .limit(30);
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(profileProcessedRequestsError());
            }

            const processedRequests: ProfileProcessedRequest[] = [];
            for (const row of response.data) {
                const processedRequest = parseProcessedRequest(row);
                if (processedRequest === null) return err(profileProcessedRequestsError());
                processedRequests.push(processedRequest);
            }
            return ok(processedRequests);
        } catch {
            return err(profileProcessedRequestsError());
        }
    }
}
