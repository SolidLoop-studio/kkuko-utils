import type { Result } from '@/src/shared/application/result';
import type { ProfileFavoriteDoc } from './profile-favorite-docs-query-types';

/** 프로필 사용자의 즐겨찾기 문서를 조회하는 Infrastructure 계약입니다. */
export interface ProfileFavoriteDocsQueryGateway {
    loadByUserId(userId: string): Promise<Result<ProfileFavoriteDoc[]>>;
}
