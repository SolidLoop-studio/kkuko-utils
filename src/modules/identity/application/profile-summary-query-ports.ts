import type { Result } from '@/src/shared/application/result';
import type { ProfileSummarySource } from './profile-summary-query-types';

/** 닉네임으로 공개 프로필 요약 원본을 조회하는 Infrastructure 계약입니다. */
export interface ProfileSummaryQueryGateway {
    loadByNickname(nickname: string): Promise<Result<ProfileSummarySource | null>>;
}
