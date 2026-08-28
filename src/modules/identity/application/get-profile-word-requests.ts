import { err, type Result } from '@/src/shared/application/result';
import type { ProfileWordRequestsQueryGateway } from './profile-word-requests-query-ports';
import type { ProfileWordRequest } from './profile-word-requests-query-types';

const profileWordRequestsError = () => ({
    kind: 'infrastructure' as const,
    message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.',
});

/** 프로필 단어 요청 내역을 검증된 public projection으로 조회합니다. */
export class GetProfileWordRequestsService {
    constructor(private readonly gateway: ProfileWordRequestsQueryGateway) {}

    async get(userId: string): Promise<Result<ProfileWordRequest[]>> {
        const normalizedUserId = userId.trim();
        if (normalizedUserId.length === 0) {
            return err({
                kind: 'validation',
                field: 'userId',
                message: '프로필 사용자 ID가 필요합니다.',
            });
        }

        try {
            const result = await this.gateway.loadByRequesterId(normalizedUserId);
            if (!result.ok) return err(profileWordRequestsError());
            return result;
        } catch {
            return err(profileWordRequestsError());
        }
    }
}
