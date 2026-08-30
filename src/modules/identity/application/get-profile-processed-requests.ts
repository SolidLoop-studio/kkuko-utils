import { err, type Result } from '@/src/shared/application/result';
import type { ProfileProcessedRequestsQueryGateway } from './profile-processed-requests-query-ports';
import type { ProfileProcessedRequest } from './profile-processed-requests-query-types';

const profileProcessedRequestsError = () => ({
    kind: 'infrastructure' as const,
    message: '처리된 요청을 불러오는 중 오류가 발생했습니다.',
});

/** 프로필 처리 요청 내역을 검증된 public projection으로 조회합니다. */
export class GetProfileProcessedRequestsService {
    constructor(private readonly gateway: ProfileProcessedRequestsQueryGateway) {}

    async get(userId: string): Promise<Result<ProfileProcessedRequest[]>> {
        const normalizedUserId = userId.trim();
        if (normalizedUserId.length === 0) {
            return err({
                kind: 'validation',
                field: 'userId',
                message: '프로필 사용자 ID가 필요합니다.',
            });
        }

        try {
            const result = await this.gateway.loadByMakerId(normalizedUserId);
            if (!result.ok) return err(profileProcessedRequestsError());
            return result;
        } catch {
            return err(profileProcessedRequestsError());
        }
    }
}
