import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { WordLogQueryGateway } from '../../application/word-log-query-ports';
import type {
    WordLogPageItem,
    WordLogPageProjection,
    WordLogPageQuery,
    WordLogRequestType,
    WordLogState,
} from '../../application/word-log-query-types';

interface QueryResponse {
    data?: unknown;
    count?: unknown;
    error?: unknown;
}

interface WordLogPageRequest extends PromiseLike<QueryResponse> {
    order(column: string, options: { ascending: false }): WordLogPageRequest;
    eq(column: string, value: string): WordLogPageRequest;
    range(from: number, to: number): WordLogPageRequest;
}

interface WordLogPageQueryBuilder {
    select(columns: string, options: { count: 'exact' }): WordLogPageRequest;
}

interface WordLogQueryClient {
    from(table: 'logs'): WordLogPageQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '로그를 불러오는 중 오류가 발생했습니다.',
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

const isWordLogState = (value: unknown): value is WordLogState => (
    value === 'approved' || value === 'rejected' || value === 'pending'
);

const isWordLogRequestType = (value: unknown): value is WordLogRequestType => (
    value === 'add' || value === 'delete'
);

const readNickname = (relation: unknown): string | null | undefined => {
    if (relation === null) return null;
    if (!isRecord(relation) || !isNullableString(relation.nickname)) return undefined;
    return relation.nickname;
};

const parseRow = (row: unknown): WordLogPageItem | null => {
    if (!isRecord(row)
        || !isPositiveSafeInteger(row.id)
        || typeof row.created_at !== 'string'
        || typeof row.word !== 'string'
        || !isNullableString(row.make_by)
        || !isNullableString(row.processed_by)
        || !isWordLogState(row.state)
        || !isWordLogRequestType(row.r_type)) {
        return null;
    }

    const requesterNickname = readNickname(row.make_by_user);
    const processorNickname = readNickname(row.processed_by_user);
    if (requesterNickname === undefined || processorNickname === undefined) return null;

    return {
        id: row.id,
        createdAt: row.created_at,
        word: row.word,
        requesterId: row.make_by,
        processorId: row.processed_by,
        state: row.state,
        requestType: row.r_type,
        requesterNickname,
        processorNickname,
    };
};

const parseResponse = (response: unknown): { items: WordLogPageItem[]; totalCount: number } | null => {
    if (!isRecord(response)
        || response.error !== null
        || !Array.isArray(response.data)
        || !isNonNegativeSafeInteger(response.count)) {
        return null;
    }

    const items: WordLogPageItem[] = [];
    for (const row of response.data) {
        const item = parseRow(row);
        if (item === null) return null;
        items.push(item);
    }
    return { items, totalCount: response.count };
};

/** 알 수 없는 Supabase 로그 행을 공개 화면 projection으로 안전하게 변환합니다. */
export class SupabaseWordLogQueryGateway implements WordLogQueryGateway {
    constructor(
        private readonly client: WordLogQueryClient = (
            browserSupabaseClient as unknown as WordLogQueryClient
        ),
    ) {}

    async loadPage(query: WordLogPageQuery): Promise<Result<WordLogPageProjection>> {
        try {
            let request = this.client
                .from('logs')
                .select('id, created_at, word, make_by, processed_by, state, r_type, make_by_user:users!logs_make_by_fkey(nickname), processed_by_user:users!logs_processed_by_fkey(nickname)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (query.state !== 'all') request = request.eq('state', query.state);
            if (query.requestType !== 'all') request = request.eq('r_type', query.requestType);

            const response = await request.range(
                (query.page - 1) * query.pageSize,
                query.page * query.pageSize - 1,
            );
            const page = parseResponse(response);
            if (page === null) return err(infrastructureError());

            return ok({
                items: page.items,
                totalCount: page.totalCount,
                page: query.page,
                pageSize: query.pageSize,
            });
        } catch {
            return err(infrastructureError());
        }
    }
}
