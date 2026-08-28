import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { ProfileWordRequestsQueryGateway } from '../../application/profile-word-requests-query-ports';
import type { ProfileWordRequest } from '../../application/profile-word-requests-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface WordRequestsQueryLimit {
    limit(count: 30): PromiseLike<QueryResponse>;
}

interface WordRequestsQueryOrder {
    order(column: 'requested_at', options: { ascending: false }): WordRequestsQueryLimit;
}

interface WordRequestsQueryFilter {
    eq(column: 'requested_by', value: string): WordRequestsQueryOrder;
}

interface WordRequestsQueryBuilder {
    select(columns: 'id, word, request_type, requested_at, status'): WordRequestsQueryFilter;
}

interface ProfileWordRequestsQueryClient {
    from(table: 'wait_words'): WordRequestsQueryBuilder;
}

const profileWordRequestsError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isRequestType = (value: unknown): value is ProfileWordRequest['requestType'] => (
    value === 'add' || value === 'delete'
);

const isRequestStatus = (value: unknown): value is ProfileWordRequest['status'] => (
    value === 'pending' || value === 'approved' || value === 'rejected'
);

const parseWordRequest = (row: unknown): ProfileWordRequest | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.word !== 'string'
        || !isRequestType(row.request_type)
        || typeof row.requested_at !== 'string'
        || !isRequestStatus(row.status)) {
        return null;
    }

    return {
        id: row.id,
        word: row.word,
        requestType: row.request_type,
        requestedAt: row.requested_at,
        status: row.status,
    };
};

/** Supabase 단어 요청 행을 프로필 활동 tab의 좁은 DTO로 투영합니다. */
export class SupabaseProfileWordRequestsQueryGateway implements ProfileWordRequestsQueryGateway {
    constructor(
        private readonly client: ProfileWordRequestsQueryClient = (
            browserSupabaseClient as unknown as ProfileWordRequestsQueryClient
        ),
    ) {}

    async loadByRequesterId(userId: string): Promise<Result<ProfileWordRequest[]>> {
        try {
            const response = await this.client
                .from('wait_words')
                .select('id, word, request_type, requested_at, status')
                .eq('requested_by', userId)
                .order('requested_at', { ascending: false })
                .limit(30);
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(profileWordRequestsError());
            }

            const wordRequests: ProfileWordRequest[] = [];
            for (const row of response.data) {
                const wordRequest = parseWordRequest(row);
                if (wordRequest === null) return err(profileWordRequestsError());
                wordRequests.push(wordRequest);
            }
            return ok(wordRequests);
        } catch {
            return err(profileWordRequestsError());
        }
    }
}
