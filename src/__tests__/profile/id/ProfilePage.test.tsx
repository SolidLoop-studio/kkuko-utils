import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../../modules/identity', () => ({ useProfileSummary: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    useSelector: () => ({ uuid: 'user-1' }),
}));
jest.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LineChart: ({ data }: { data: unknown }) => <div data-testid="monthly-chart">{JSON.stringify(data)}</div>,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
}));

const starredDocsById = jest.fn().mockResolvedValue({ data: [], error: null });
const requestsListById = jest.fn().mockResolvedValue({ data: [], error: null });
const logsListById = jest.fn().mockResolvedValue({ data: [], error: null });
const userByNickname = jest.fn().mockResolvedValue({
    data: {
        id: 'user-1', nickname: '테스터', role: 'admin', contribution: 120, month_contribution: 42,
    },
    error: null,
});
const monthlyConRankByUserId = jest.fn().mockResolvedValue({ data: 3, error: null });
const monthlyContributionsByUserId = jest.fn().mockResolvedValue({ data: [], error: null });

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: () => ({
            starredDocsById,
            requestsListById,
            logsListById,
            userByNickname,
            monthlyConRankByUserId,
            monthlyContributionsByUserId,
            usersByNickname: jest.fn(),
        }),
    },
}));

import ProfilePage from '@/src/app/profile/[username]/ProfilePage';
import type { ProfileSummaryProjection } from '../../../modules/identity';
import { useProfileSummary } from '../../../modules/identity';

const projection: ProfileSummaryProjection = {
    id: 'user-1',
    nickname: '테스터',
    role: 'admin',
    totalContribution: 120,
    monthlyContribution: 42,
    monthlyContributionRank: 3,
    recentMonthlyContributions: [
        { month: '2026-04', contribution: 4 },
        { month: '2026-05', contribution: 0 },
        { month: '2026-06', contribution: 6 },
        { month: '2026-07', contribution: 7 },
        { month: '2026-08', contribution: 42 },
    ],
};

const mockSummary = (value: Partial<ReturnType<typeof useProfileSummary>>) => {
    jest.mocked(useProfileSummary).mockReturnValue(value as ReturnType<typeof useProfileSummary>);
};

describe('ProfilePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSummary({ isPending: false, data: projection, error: null });
    });

    test('renders every main card field from the summary projection and loads excluded activities once', async () => {
        // Break caught: retaining the three legacy summary getters instead of consuming one projection.
        render(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('테스터')).toBeInTheDocument());
        expect(screen.getByText('관리자')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('3등')).toBeInTheDocument();
        expect(screen.getByTestId('monthly-chart')).toHaveTextContent('2026-04');
        expect(screen.getByRole('link', { name: '관리자 대시보드' })).toHaveAttribute('href', '/admin');
        await waitFor(() => expect(starredDocsById).toHaveBeenCalledWith('user-1'));
        expect(requestsListById).toHaveBeenCalledWith('user-1');
        expect(logsListById).toHaveBeenCalledWith('user-1');
        expect(userByNickname).not.toHaveBeenCalled();
        expect(monthlyConRankByUserId).not.toHaveBeenCalled();
        expect(monthlyContributionsByUserId).not.toHaveBeenCalled();
    });

    test('shows the pending overlay and a stable summary error Modal', async () => {
        // Break caught: bypassing query pending/error state or exposing raw query details in the page.
        mockSummary({ isPending: true, data: undefined, error: null });
        const { rerender } = render(<ProfilePage userName="테스터" />);

        expect(screen.getByText('유저 데이터 가져 오는 중...')).toBeInTheDocument();
        mockSummary({
            isPending: false,
            data: undefined,
            error: { kind: 'infrastructure', message: '프로필 정보를 불러오는 중 오류가 발생했습니다.' },
        });
        rerender(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('프로필 정보를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument());
    });

    test('renders guest explicitly without role progress or privileged panels', async () => {
        // Break caught: using the former untyped fallback role UI for nullable guest profiles.
        mockSummary({
            isPending: false,
            data: { ...projection, role: 'guest', monthlyContributionRank: 0 },
            error: null,
        });
        render(<ProfilePage userName="게스트" />);

        await waitFor(() => expect(screen.getByText('게스트')).toBeInTheDocument());
        expect(screen.getByTestId('badge')).toHaveClass('bg-gray-100', 'text-gray-800');
        expect(screen.queryByText('다음 등급까지')).not.toBeInTheDocument();
        expect(screen.queryByText('🎉 최고등급 달성!')).not.toBeInTheDocument();
        expect(screen.queryByText('👑 관리자 등급입니다')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '관리자 대시보드' })).not.toBeInTheDocument();
    });
});
