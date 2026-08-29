import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';

jest.unmock('../../app/components/ui/card');

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../modules/admin-dashboard', () => ({
    useAdminDashboardSummary: jest.fn(),
}));

import AdminDashboard from '@/src/app/admin/AdminPage';
import { useAdminDashboardSummary } from '@/src/modules/admin-dashboard';

const setSummaryQuery = ({
    data,
    error = null,
    isLoading = false,
}: {
    data?: { totalWords: number; pendingWordChanges: number };
    error?: { kind: string; message: string } | null;
    isLoading?: boolean;
}) => {
    jest.mocked(useAdminDashboardSummary).mockReturnValue({
        data,
        error,
        isLoading,
    } as never);
};

describe('AdminDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setSummaryQuery({
            data: { totalWords: 123_456, pendingWordChanges: 17 },
        });
    });

    test('shows a loading value in both statistic cards while the projection is pending', () => {
        // Break caught: rendering stale/default counts before React Query resolves.
        setSummaryQuery({ isLoading: true });

        render(<AdminDashboard />);

        expect(screen.getAllByText('로딩 중...')).toHaveLength(2);
        expect(screen.getByText('총 단어 수')).toBeInTheDocument();
        expect(screen.getByText('처리 대기 요청')).toBeInTheDocument();
    });

    test('renders the successful total and combined pending count projection', () => {
        // Break caught: swapping the two fields or omitting exact zero/non-zero values from cards.
        render(<AdminDashboard />);

        expect(screen.getByText('123,456')).toBeInTheDocument();
        expect(screen.getByText('17')).toBeInTheDocument();
    });

    test('renders exact zero values in both statistic cards', () => {
        // Break caught: treating zero as absent and replacing it with a dash or loading copy.
        setSummaryQuery({
            data: { totalWords: 0, pendingWordChanges: 0 },
        });

        render(<AdminDashboard />);

        expect(screen.getAllByText('0')).toHaveLength(2);
        expect(screen.queryByText('—')).not.toBeInTheDocument();
        expect(screen.queryByText('로딩 중...')).not.toBeInTheDocument();
    });

    test('opens the project failure Modal with fixed Korean copy and no raw query diagnostics', () => {
        // Break caught: logging/rendering a backend error or replacing the project Modal with inline text.
        setSummaryQuery({
            error: {
                kind: 'infrastructure',
                message: 'private PostgREST words_count detail',
            },
        });

        render(<AdminDashboard />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('관리자 대시보드 조회 오류')).toBeInTheDocument();
        expect(screen.getByText(
            '관리자 대시보드 정보를 불러오는 중 오류가 발생했습니다.',
        )).toBeInTheDocument();
        expect(screen.queryByText(/private|PostgREST|words_count/)).not.toBeInTheDocument();
    });

    test('depends only on the admin-dashboard presentation boundary for server state', () => {
        // Break caught: coupling the admin landing page back to Supabase, PostgREST, or legacy SCM.
        const source = readFileSync(
            join(process.cwd(), 'src/app/admin/AdminPage.tsx'),
            'utf8',
        );
        const forbiddenCoupling = [
            /@supabase\/supabase-js/,
            /\bbrowserSupabaseClient\b/,
            /\bPostgrestError\b/,
            /\bSCM\b/,
            /\bwordsCount\b/,
            /\bwaitWordsCount\b/,
            /\.from\s*\(/,
            /\.rpc\s*\(/,
        ];

        for (const forbidden of forbiddenCoupling) expect(source).not.toMatch(forbidden);
    });
});
