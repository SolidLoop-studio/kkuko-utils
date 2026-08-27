import type { Result } from '@/src/shared/application/result';
import type { ProfileSearchItem } from './profile-search-query-types';

/** 닉네임 일부와 일치하는 공개 프로필을 조회하는 Infrastructure 계약입니다. */
export interface ProfileSearchQueryGateway {
    searchByNickname(query: string): Promise<Result<ProfileSearchItem[]>>;
}
