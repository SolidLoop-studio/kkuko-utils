import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../modules/identity', () => ({
    useProfileFavoriteDocs: jest.fn(),
    useProfileProcessedRequests: jest.fn(),
    useProfileWordRequests: jest.fn(),
    useProfileSummary: jest.fn(),
}));
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

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: () => ({
            usersByNickname: jest.fn(),
        }),
    },
}));

import ProfilePage from '@/src/app/profile/[username]/ProfilePage';
import type { ProfileSummaryProjection } from '../../../modules/identity';
import { useProfileFavoriteDocs, useProfileSummary, useProfileWordRequests } from '../../../modules/identity';

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

const mockFavoriteDocs = (value: Partial<ReturnType<typeof useProfileFavoriteDocs>>) => {
    jest.mocked(useProfileFavoriteDocs).mockReturnValue(value as ReturnType<typeof useProfileFavoriteDocs>);
};

const mockWordRequests = (value: Partial<ReturnType<typeof useProfileWordRequests>>) => {
    jest.mocked(useProfileWordRequests).mockReturnValue(value as ReturnType<typeof useProfileWordRequests>);
};

const mockProcessedRequests = (value: unknown) => {
    const identity = jest.requireMock('../../../modules/identity') as {
        useProfileProcessedRequests: jest.Mock;
    };
    identity.useProfileProcessedRequests.mockReturnValue(value);
};

describe('ProfilePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSummary({ isPending: false, data: projection, error: null });
        mockFavoriteDocs({ isPending: false, data: [], error: null });
        mockWordRequests({ isPending: false, data: [], error: null });
        mockProcessedRequests({ isPending: false, data: [], error: null });
    });

    test('renders every main card field from the summary projection', async () => {
        // Break caught: retaining the replaced profile summary getters instead of consuming one projection.
        render(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('테스터')).toBeInTheDocument());
        expect(screen.getByText('관리자')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('3등')).toBeInTheDocument();
        expect(screen.getByTestId('monthly-chart')).toHaveTextContent(JSON.stringify(
            projection.recentMonthlyContributions,
        ));
        expect(screen.getByRole('link', { name: '관리자 대시보드' })).toHaveAttribute('href', '/admin');
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

    test('renders favorite documents from the feature hook and shows a safe tab error', async () => {
        // Break caught: keeping favorite documents in the legacy SCM loader or exposing raw tab failures.
        mockFavoriteDocs({
            isPending: false,
            data: [{
                id: 42,
                name: '테스트 문서',
                type: 'theme',
                lastUpdatedAt: '2026-08-27T00:00:00.000Z',
            }],
            error: null,
        });
        const { rerender } = render(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByRole('link', { name: /테스트 문서/ })).toHaveAttribute('href', '/words-docs/42'));
        expect(screen.getByText('theme')).toBeInTheDocument();

        mockFavoriteDocs({
            isPending: false,
            data: undefined,
            error: { kind: 'infrastructure', message: '즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.' },
        });
        rerender(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('즐겨찾기한 문서를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument());
    });

    test('renders word requests from the feature hook and shows a safe tab error', async () => {
        // Break caught: keeping word requests in the legacy SCM loader or exposing raw tab failures.
        mockWordRequests({
            isPending: false,
            data: [{
                id: 42,
                word: '테스트단어',
                requestType: 'add',
                requestedAt: '2026-08-27T00:00:00.000Z',
                status: 'pending',
            }],
            error: null,
        });
        const { rerender } = render(<ProfilePage userName="테스터" />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('tab', { name: '요청 내역' }));

        await waitFor(() => expect(screen.getByText('테스트단어')).toBeInTheDocument());
        expect(screen.getByText(/추가 요청/)).toBeInTheDocument();
        expect(screen.getByText('대기중')).toBeInTheDocument();

        mockWordRequests({
            isPending: false,
            data: undefined,
            error: { kind: 'infrastructure', message: '단어 요청 내역을 불러오는 중 오류가 발생했습니다.' },
        });
        rerender(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('단어 요청 내역을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument());
    });

    test('renders processed requests from the feature hook and shows a safe tab error', async () => {
        // Break caught: keeping processed activity in the legacy SCM loader instead of the identity query hook.
        mockProcessedRequests({
            isPending: false,
            data: [{
                id: 43,
                word: '처리단어',
                requestType: 'delete',
                createdAt: '2026-08-27T00:00:00.000Z',
                state: 'approved',
            }],
            error: null,
        });
        const { rerender } = render(<ProfilePage userName="테스터" />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('tab', { name: '처리 내역' }));

        await waitFor(() => expect(screen.getByText('처리단어')).toBeInTheDocument());
        expect(screen.getByText(/삭제/)).toBeInTheDocument();
        expect(screen.getByText('승인됨')).toBeInTheDocument();

        mockProcessedRequests({
            isPending: false,
            data: undefined,
            error: { kind: 'infrastructure', message: '처리된 요청을 불러오는 중 오류가 발생했습니다.' },
        });
        rerender(<ProfilePage userName="테스터" />);

        await waitFor(() => expect(screen.getByText('처리된 요청을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument());
    });
});
