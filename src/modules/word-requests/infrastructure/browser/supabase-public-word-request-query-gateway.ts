import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { PublicWordRequestPageQueryGateway } from '../../application/public-word-request-query-ports';
import {
    PUBLIC_WORD_REQUEST_PAGE_SIZE,
    type PublicWordRequestPageProjection,
    type PublicWordRequestProjection,
    type PublicWordRequestQueryInput,
} from '../../application/public-word-request-query-types';

interface QueryResponse {
    data: unknown;
    error: unknown;
    count: unknown;
}

interface PublicWordRequestQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string, options: { count: 'exact' }): PublicWordRequestQueryBuilder;
    eq(column: 'status', value: 'pending' | 'approved' | 'rejected'): PublicWordRequestQueryBuilder;
    order(column: 'requested_at', options: { ascending: true }): PublicWordRequestQueryBuilder;
    range(from: number, to: number): PromiseLike<QueryResponse>;
}

interface PublicWordRequestQueryClient {
    from(table: 'wait_words'): PublicWordRequestQueryBuilder;
}

const publicWordRequestError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
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

const parseRequesterNickname = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (!isRecord(value) || typeof value.nickname !== 'string') return undefined;
    return value.nickname;
};

const parseRow = (value: unknown): PublicWordRequestProjection | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || (value.request_type !== 'add' && value.request_type !== 'delete')
        || typeof value.requested_at !== 'string'
        || !isNullableString(value.requested_by)
        || (value.status !== 'pending' && value.status !== 'approved' && value.status !== 'rejected')
        || typeof value.word !== 'string'
        || (value.word_id !== null && !isPositiveSafeInteger(value.word_id))) return null;

    const requesterNickname = parseRequesterNickname(value.users);
    if (requesterNickname === undefined) return null;
    return {
        id: value.id,
        requestType: value.request_type,
        requestedAt: value.requested_at,
        requestedBy: value.requested_by,
        status: value.status,
        word: value.word,
        wordId: value.word_id,
        requesterNickname,
    };
};

const parseRows = (value: unknown): PublicWordRequestProjection[] | null => {
    if (!Array.isArray(value)) return null;
    const rows: PublicWordRequestProjection[] = [];
    for (const item of value) {
        const row = parseRow(item);
        if (row === null) return null;
        rows.push(row);
    }
    return rows;
};

/** Supabase 공개 단어 요청 행을 좁은 camelCase 페이지 projection으로 변환합니다. */
export class SupabasePublicWordRequestQueryGateway implements PublicWordRequestPageQueryGateway {
    constructor(
        private readonly client: PublicWordRequestQueryClient = (
            browserSupabaseClient as unknown as PublicWordRequestQueryClient
        ),
    ) {}

    async load(input: PublicWordRequestQueryInput): Promise<Result<PublicWordRequestPageProjection>> {
        try {
            const from = (input.page - 1) * PUBLIC_WORD_REQUEST_PAGE_SIZE;
            const to = input.page * PUBLIC_WORD_REQUEST_PAGE_SIZE - 1;
            let query = this.client
                .from('wait_words')
                .select('id, request_type, requested_at, requested_by, status, word, word_id, users(nickname)', {
                    count: 'exact',
                });
            if (input.status !== 'all') query = query.eq('status', input.status);

            const response = await query
                .order('requested_at', { ascending: true })
                .range(from, to);
            if (!isRecord(response) || response.error !== null || !isNonNegativeSafeInteger(response.count)) {
                return err(publicWordRequestError());
            }
            const items = parseRows(response.data);
            if (items === null) return err(publicWordRequestError());
            return ok({
                page: input.page,
                pageSize: PUBLIC_WORD_REQUEST_PAGE_SIZE,
                totalCount: response.count,
                items,
            });
        } catch {
            return err(publicWordRequestError());
        }
    }
}
