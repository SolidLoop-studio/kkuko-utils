import { err, ok, type Result } from '@/src/shared/application/result';
import type { ProfileSummaryQueryGateway } from './profile-summary-query-ports';
import type {
    ProfileMonthlyContribution,
    ProfileSummaryProjection,
    ProfileSummarySource,
} from './profile-summary-query-types';

const profileSummaryError = () => ({
    kind: 'infrastructure' as const,
    message: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
});

const monthKey = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

const recentMonthKeys = (clock: Date): string[] => Array.from({ length: 5 }, (_value, index) => {
    const date = new Date(clock.getFullYear(), clock.getMonth() - 4 + index, 1);
    return monthKey(date.getFullYear(), date.getMonth());
});

const project = (source: ProfileSummarySource, clock: Date): ProfileSummaryProjection => {
    const months = recentMonthKeys(clock);
    const contributions = new Map<string, number>();
    source.historicalMonthlyContributions.forEach(({ month, contribution }) => {
        contributions.set(month, contribution);
    });
    contributions.set(months[months.length - 1], source.monthlyContribution);

    const recentMonthlyContributions: ProfileMonthlyContribution[] = months.map((month) => ({
        month,
        contribution: contributions.get(month) ?? 0,
    }));
    const { historicalMonthlyContributions: _history, ...summary } = source;
    return { ...summary, recentMonthlyContributions };
};

/** 프로필 요약 원본을 검증하고 최근 다섯 달 chart projection으로 변환합니다. */
export class GetProfileSummaryService {
    constructor(
        private readonly gateway: ProfileSummaryQueryGateway,
        private readonly clock: () => Date = () => new Date(),
    ) {}

    async get(nickname: string): Promise<Result<ProfileSummaryProjection>> {
        const normalizedNickname = nickname.trim();
        if (normalizedNickname.length === 0) {
            return err({
                kind: 'validation',
                field: 'nickname',
                message: '닉네임을 입력해주세요.',
            });
        }

        try {
            const result = await this.gateway.loadByNickname(normalizedNickname);
            if (!result.ok) return result;
            if (result.value === null) {
                return err({ kind: 'not-found', message: '사용자를 찾을 수 없습니다.' });
            }
            return ok(project(result.value, this.clock()));
        } catch {
            return err(profileSummaryError());
        }
    }
}
