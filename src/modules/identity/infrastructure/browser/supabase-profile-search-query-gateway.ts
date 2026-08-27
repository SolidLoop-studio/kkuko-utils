import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { IdentityRole } from '../../application/auth-types';
import type { ProfileSearchQueryGateway } from '../../application/profile-search-query-ports';
import type { ProfileSearchItem } from '../../application/profile-search-query-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface ProfileSearchQueryFilter {
    ilike(column: string, pattern: string): PromiseLike<QueryResponse>;
}

interface ProfileSearchQueryBuilder {
    select(columns: string): ProfileSearchQueryFilter;
}

interface ProfileSearchQueryClient {
    from(table: 'users'): ProfileSearchQueryBuilder;
}

const identityRoles = new Set<IdentityRole>(['guest', 'r1', 'r2', 'r3', 'r4', 'admin']);

const profileSearchError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '사용자 검색 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isContribution = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const parseProfile = (value: unknown): ProfileSearchItem | null => {
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

/** Supabase users 행을 공개 프로필 검색 projection으로 한정해 조회하고 검증합니다. */
export class SupabaseProfileSearchQueryGateway implements ProfileSearchQueryGateway {
    constructor(
        private readonly client: ProfileSearchQueryClient = (
            browserSupabaseClient as unknown as ProfileSearchQueryClient
        ),
    ) {}

    async searchByNickname(query: string): Promise<Result<ProfileSearchItem[]>> {
        try {
            const response = await this.client
                .from('users')
                .select('id, nickname, role, contribution, month_contribution')
                .ilike('nickname', `%${query}%`);
            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(profileSearchError());
            }

            const profiles: ProfileSearchItem[] = [];
            for (const row of response.data) {
                const profile = parseProfile(row);
                if (profile === null) return err(profileSearchError());
                profiles.push(profile);
            }
            return ok(profiles);
        } catch {
            return err(profileSearchError());
        }
    }
}
