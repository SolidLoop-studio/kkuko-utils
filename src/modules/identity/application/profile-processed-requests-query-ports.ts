import type { Result } from '@/src/shared/application/result';
import type { ProfileProcessedRequest } from './profile-processed-requests-query-types';

/** 프로필 사용자가 처리한 요청 내역을 조회하는 Infrastructure 계약입니다. */
export interface ProfileProcessedRequestsQueryGateway {
    loadByMakerId(userId: string): Promise<Result<ProfileProcessedRequest[]>>;
}
