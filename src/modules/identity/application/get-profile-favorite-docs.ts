import { err, type Result } from '@/src/shared/application/result';
import type { ProfileFavoriteDocsQueryGateway } from './profile-favorite-docs-query-ports';
import type { ProfileFavoriteDoc } from './profile-favorite-docs-query-types';

const profileFavoriteDocsError = () => ({
    kind: 'infrastructure' as const,
    message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.',
});

/** 프로필 즐겨찾기 문서를 검증된 public projection으로 조회합니다. */
export class GetProfileFavoriteDocsService {
    constructor(private readonly gateway: ProfileFavoriteDocsQueryGateway) {}

    async get(userId: string): Promise<Result<ProfileFavoriteDoc[]>> {
        const normalizedUserId = userId.trim();
        if (normalizedUserId.length === 0) {
            return err({
                kind: 'validation',
                field: 'userId',
                message: '프로필 사용자 ID가 필요합니다.',
            });
        }

        try {
            const result = await this.gateway.loadByUserId(normalizedUserId);
            if (!result.ok) return err(profileFavoriteDocsError());
            return result;
        } catch {
            return err(profileFavoriteDocsError());
        }
    }
}
