import type { Result } from '@/src/shared/application/result';
import type { ProfileWordRequest } from './profile-word-requests-query-types';

/** 프로필 사용자의 단어 요청 내역을 조회하는 Infrastructure 계약입니다. */
export interface ProfileWordRequestsQueryGateway {
    loadByRequesterId(userId: string): Promise<Result<ProfileWordRequest[]>>;
}
