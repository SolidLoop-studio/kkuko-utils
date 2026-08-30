import type { Result } from '@/src/shared/application/result';
import type { CurrentUserProfile } from './auth-types';

/** 공개 사용자 프로필 행을 인증 기능과 별도로 조회하는 계약입니다. */
export interface CurrentUserProfileQueryGateway {
    loadByUserId(userId: string): Promise<Result<CurrentUserProfile | null>>;
}
