import type { IdentityRole } from './auth-types';

/** 프로필 차트에서 사용하는 월별 기여도 값입니다. */
export interface ProfileMonthlyContribution {
    month: string;
    contribution: number;
}

/** Infrastructure가 조회한 프로필 요약의 원본 값입니다. */
export interface ProfileSummarySource {
    id: string;
    nickname: string;
    role: IdentityRole;
    totalContribution: number;
    monthlyContribution: number;
    monthlyContributionRank: number;
    historicalMonthlyContributions: ProfileMonthlyContribution[];
}

/** 화면에 안전하게 전달하는 프로필 요약 projection입니다. */
export interface ProfileSummaryProjection
    extends Omit<ProfileSummarySource, 'historicalMonthlyContributions'> {
    recentMonthlyContributions: ProfileMonthlyContribution[];
}
