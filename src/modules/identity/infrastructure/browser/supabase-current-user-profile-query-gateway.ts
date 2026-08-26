import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { CurrentUserProfile, IdentityRole } from '../../application/auth-types';
import type { CurrentUserProfileQueryGateway } from '../../application/user-profile-query-ports';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface UserProfileQueryBuilder {
    select(columns: string): UserProfileQueryBuilder;
    eq(column: string, value: string): UserProfileQueryBuilder;
    maybeSingle(): PromiseLike<QueryResponse>;
}

interface UserProfileQueryClient {
    from(table: 'users'): UserProfileQueryBuilder;
}

const identityRoles = new Set<IdentityRole>(['guest', 'r1', 'r2', 'r3', 'r4', 'admin']);

const profileError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseProfile = (value: unknown, userId: string): CurrentUserProfile | null => {
    if (!isRecord(value)
        || value.id !== userId
        || typeof value.nickname !== 'string'
        || (value.role !== null && !identityRoles.has(value.role as IdentityRole))) {
        return null;
    }
    return {
        id: value.id,
        nickname: value.nickname,
        role: value.role === null ? 'guest' : value.role as IdentityRole,
    };
};

/** users 행에서 현재 UI에 필요한 공개 필드만 조회하고 검증합니다. */
export class SupabaseCurrentUserProfileQueryGateway implements CurrentUserProfileQueryGateway {
    constructor(
        private readonly client: UserProfileQueryClient = (
            browserSupabaseClient as unknown as UserProfileQueryClient
        ),
    ) {}

    async loadByUserId(userId: string): Promise<Result<CurrentUserProfile | null>> {
        try {
            const response = await this.client
                .from('users')
                .select('id, nickname, role')
                .eq('id', userId)
                .maybeSingle();
            if (!isRecord(response) || response.error !== null) return err(profileError());
            if (response.data === null) return ok(null);
            const profile = parseProfile(response.data, userId);
            return profile === null ? err(profileError()) : ok(profile);
        } catch {
            return err(profileError());
        }
    }
}
