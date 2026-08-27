import type { IdentityRole } from './auth-types';

/** 프로필 검색 결과를 화면에 전달하는 최소 공개 projection입니다. */
export interface ProfileSearchItem {
    id: string;
    nickname: string;
    role: IdentityRole;
    totalContribution: number;
    monthlyContribution: number;
}
