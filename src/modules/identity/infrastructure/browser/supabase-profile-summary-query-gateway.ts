import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { IdentityRole } from '../../application/auth-types';
import type { ProfileSummaryQueryGateway } from '../../application/profile-summary-query-ports';
import type {
    ProfileMonthlyContribution,
    ProfileSummarySource,
} from '../../application/profile-summary-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface UserQueryFilter {
    maybeSingle(): PromiseLike<QueryResponse>;
}

interface UserQueryBuilder {
    eq(column: 'nickname', value: string): UserQueryFilter;
}

interface UserSelectQuery {
    select(columns: 'id, nickname, role, contribution, month_contribution'): UserQueryBuilder;
}

interface HistoryQueryLimit {
    limit(count: 4): PromiseLike<QueryResponse>;
}

interface HistoryQueryOrder {
    order(column: 'month', options: { ascending: false }): HistoryQueryLimit;
}

interface HistoryQueryFilter {
    eq(column: 'user_id', value: string): HistoryQueryOrder;
}

interface HistorySelectQuery {
    select(columns: 'month, contribution'): HistoryQueryFilter;
}

interface ProfileSummaryQueryClient {
    from(table: 'users'): UserSelectQuery;
    from(table: 'user_month_contributions'): HistorySelectQuery;
    rpc(name: 'get_user_monthly_rank', parameters: { uid: string }): PromiseLike<QueryResponse>;
}

const identityRoles = new Set<IdentityRole>(['guest', 'r1', 'r2', 'r3', 'r4', 'admin']);

const profileSummaryError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isContribution = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isSuccessfulResponse = (value: unknown): value is QueryResponse => (
    isRecord(value) && value.error === null
);

const parseUser = (value: unknown): Omit<ProfileSummarySource, 'monthlyContributionRank' | 'historicalMonthlyContributions'> | null => {
    if (!isRecord(value)
        || typeof value.id !== 'string'
        || typeof value.nickname !== 'string'
        || (value.role !== null && !identityRoles.has(value.role as IdentityRole))
        || !isContribution(value.contribution)
        || !isContribution(value.month_contribution)) {
        return null;
    }

    return {
        id: value.id,
        nickname: value.nickname,
        role: value.role === null ? 'guest' : value.role as IdentityRole,
        totalContribution: value.contribution,
        monthlyContribution: value.month_contribution,
    };
};

const parseMonth = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const month = value.slice(0, 7);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
};

const parseHistory = (value: unknown): ProfileMonthlyContribution[] | null => {
    if (!Array.isArray(value)) return null;

    const history: ProfileMonthlyContribution[] = [];
    for (const row of value) {
        if (!isRecord(row)) return null;
        const month = parseMonth(row.month);
        if (month === null || !isContribution(row.contribution)) return null;
        history.push({ month, contribution: row.contribution });
    }
    return history;
};

/** Supabase 조회 응답을 프로필 요약 source DTO로 순차 검증해 변환합니다. */
export class SupabaseProfileSummaryQueryGateway implements ProfileSummaryQueryGateway {
    constructor(
        private readonly client: ProfileSummaryQueryClient = (
            browserSupabaseClient as unknown as ProfileSummaryQueryClient
        ),
    ) {}

    async loadByNickname(nickname: string): Promise<Result<ProfileSummarySource | null>> {
        try {
            const userResponse = await this.client
                .from('users')
                .select('id, nickname, role, contribution, month_contribution')
                .eq('nickname', nickname)
                .maybeSingle();
            if (!isSuccessfulResponse(userResponse)) return err(profileSummaryError());
            if (userResponse.data === null) return ok(null);

            const user = parseUser(userResponse.data);
            if (user === null) return err(profileSummaryError());

            const [rankResponse, historyResponse] = await Promise.all([
                this.client.rpc('get_user_monthly_rank', { uid: user.id }),
                this.client
                    .from('user_month_contributions')
                    .select('month, contribution')
                    .eq('user_id', user.id)
                    .order('month', { ascending: false })
                    .limit(4),
            ]);
            if (!isSuccessfulResponse(rankResponse)
                || !isContribution(rankResponse.data)
                || !isSuccessfulResponse(historyResponse)) {
                return err(profileSummaryError());
            }

            const historicalMonthlyContributions = parseHistory(historyResponse.data);
            if (historicalMonthlyContributions === null) return err(profileSummaryError());

            return ok({
                ...user,
                monthlyContributionRank: rankResponse.data,
                historicalMonthlyContributions,
            });
        } catch {
            return err(profileSummaryError());
        }
    }
}
