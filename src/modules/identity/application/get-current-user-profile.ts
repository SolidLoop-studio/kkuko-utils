import { err, type Result } from '@/src/shared/application/result';
import type { CurrentUserProfile } from './auth-types';
import type { CurrentUserProfileQueryGateway } from './user-profile-query-ports';

const profileError = () => ({
    kind: 'infrastructure' as const,
    message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
});

/** 인증된 사용자 ID로 공개 프로필 projection을 조회합니다. */
export class GetCurrentUserProfileService {
    constructor(private readonly gateway: CurrentUserProfileQueryGateway) {}

    async get(userId: string): Promise<Result<CurrentUserProfile | null>> {
        if (userId.trim().length === 0) {
            return err({
                kind: 'validation',
                message: '올바른 사용자 ID가 필요합니다.',
            });
        }

        try {
            return await this.gateway.loadByUserId(userId);
        } catch {
            return err(profileError());
        }
    }
}
