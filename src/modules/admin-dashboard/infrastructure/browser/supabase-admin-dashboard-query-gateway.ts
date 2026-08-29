import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { AdminDashboardQueryGateway } from '../../application/admin-dashboard-query-ports';
import type { AdminDashboardSummary } from '../../application/admin-dashboard-query-types';

interface QueryResponse {
    data?: unknown;
    count?: unknown;
    error?: unknown;
}

interface SingleQuery {
    single(): PromiseLike<QueryResponse>;
}

type AdminDashboardTable = 'words_count' | 'wait_words' | 'word_themes_wait';

interface AdminDashboardQueryClient {
    from(table: AdminDashboardTable): {
        select(
            columns: string,
            options?: { count: 'exact'; head: true },
        ): unknown;
    };
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const readTotalWords = (response: unknown): number | null => {
    if (!isRecord(response)
        || response.error !== null
        || !isRecord(response.data)
        || !isNonNegativeSafeInteger(response.data.total_words)) {
        return null;
    }

    return response.data.total_words;
};

const readExactCount = (response: unknown): number | null => {
    if (!isRecord(response)
        || response.error !== null
        || !isNonNegativeSafeInteger(response.count)) {
        return null;
    }

    return response.count;
};

/** 관리자 대시보드의 세 집계 조회를 동시에 시작하고 안전한 projection으로 변환합니다. */
export class SupabaseAdminDashboardQueryGateway implements AdminDashboardQueryGateway {
    constructor(
        private readonly client: AdminDashboardQueryClient = (
            browserSupabaseClient as unknown as AdminDashboardQueryClient
        ),
    ) {}

    async loadSummary(): Promise<Result<AdminDashboardSummary>> {
        try {
            const totalWordsRequest = (
                this.client.from('words_count').select('total_words') as SingleQuery
            ).single();
            const waitWordsRequest = this.client
                .from('wait_words')
                .select('word', { count: 'exact', head: true }) as PromiseLike<QueryResponse>;
            const waitThemesRequest = this.client
                .from('word_themes_wait')
                .select('word_id', { count: 'exact', head: true }) as PromiseLike<QueryResponse>;

            const [totalWordsResponse, waitWordsResponse, waitThemesResponse] = await Promise.all([
                totalWordsRequest,
                waitWordsRequest,
                waitThemesRequest,
            ]);
            const totalWords = readTotalWords(totalWordsResponse);
            const waitWordsCount = readExactCount(waitWordsResponse);
            const waitThemesCount = readExactCount(waitThemesResponse);
            if (totalWords === null || waitWordsCount === null || waitThemesCount === null) {
                return err(infrastructureError());
            }

            const pendingWordChanges = waitWordsCount + waitThemesCount;
            if (!isNonNegativeSafeInteger(pendingWordChanges)) {
                return err(infrastructureError());
            }

            return ok({ totalWords, pendingWordChanges });
        } catch {
            return err(infrastructureError());
        }
    }
}
