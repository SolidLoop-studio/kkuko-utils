import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../modules/word-catalog', () => ({
    useWordStatistics: jest.fn(),
}));

jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: jest.fn(({ count }: { count: number }) => ({
        getTotalSize: () => count * 140,
        getVirtualItems: () => Array.from(
            { length: count },
            (_, index) => ({ index, key: index, start: index * 140 }),
        ),
        measureElement: jest.fn(),
    })),
}));

import { WordStatsHome } from '../../../app/word/stats/WordStatsHome';
import { useWordStatistics, type WordStatistics } from '../../../modules/word-catalog';

const statistics: WordStatistics = {
    firstLetter: [
        {
            letter: '가',
            acknowledgedCount: 10,
            notAcknowledgedCount: 4,
            acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
            notAcknowledgedUpdatedAt: null,
        },
        {
            letter: '나',
            acknowledgedCount: 30,
            notAcknowledgedCount: 5,
            acknowledgedUpdatedAt: null,
            notAcknowledgedUpdatedAt: '2026-08-25T00:00:00Z',
        },
        {
            letter: '다',
            acknowledgedCount: 5,
            notAcknowledgedCount: 12,
            acknowledgedUpdatedAt: '2026-08-26T00:00:00Z',
            notAcknowledgedUpdatedAt: '2026-08-27T00:00:00Z',
        },
    ],
    lastLetter: [{
        letter: '각',
        acknowledgedCount: 21,
        notAcknowledgedCount: 8,
        acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
        notAcknowledgedUpdatedAt: '2026-08-25T00:00:00Z',
    }],
    threeLetter: [{
        letter: '콩',
        acknowledgedCount: 3,
        notAcknowledgedCount: 2,
        acknowledgedUpdatedAt: null,
        notAcknowledgedUpdatedAt: null,
    }],
};

const setStatisticsQuery = ({
    data = statistics,
    error = null,
    isLoading = false,
}: {
    data?: WordStatistics;
    error?: { kind: string; message: string } | null;
    isLoading?: boolean;
} = {}) => {
    jest.mocked(useWordStatistics).mockReturnValue({
        data,
        error,
        isLoading,
    } as never);
};

const statisticLinks = () => screen.getAllByRole('link').map((link) => link.textContent);

describe('WordStatsHome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setStatisticsQuery();
    });

    it('shows the loading indicator while statistics are loading', () => {
        setStatisticsQuery({ isLoading: true });

        render(<WordStatsHome />);

        expect(screen.getByText('데이터를 불러오는 중...')).toBeInTheDocument();
    });

    it('shows only the stable public error message when the query fails', () => {
        setStatisticsQuery({
            error: { kind: 'infrastructure', message: 'private database failure' },
        });

        render(<WordStatsHome />);

        expect(screen.getByText('데이터를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private database failure')).not.toBeInTheDocument();
    });

    it('renders first-letter DTO counts by default and keeps the first-letter search link', () => {
        render(<WordStatsHome />);

        expect(screen.getByText('첫 글자별 통계')).toBeInTheDocument();
        expect(screen.getAllByText('30')).not.toHaveLength(0);
        expect(screen.getAllByText('5')).not.toHaveLength(0);
        expect(screen.getByRole('link', { name: '나' })).toHaveAttribute(
            'href',
            '/word/search?mode=f&q=나',
        );
    });

    it('renders last-letter DTO data and links after selecting the last-letter mode', async () => {
        const user = userEvent.setup();
        render(<WordStatsHome />);

        await user.click(screen.getByRole('button', { name: '끝 글자 통계' }));

        expect(screen.getByText('끝 글자별 통계')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '각' })).toHaveAttribute(
            'href',
            '/word/search?mode=l&q=각',
        );
        expect(screen.getAllByText('21')).not.toHaveLength(0);
        expect(screen.getAllByText('8')).not.toHaveLength(0);
    });

    it('renders three-letter DTO data and links after selecting the three-letter mode', async () => {
        const user = userEvent.setup();
        render(<WordStatsHome />);

        await user.click(screen.getByRole('button', { name: '쿵쿵따 통계' }));

        expect(screen.getByText('쿵쿵따 첫 글자별 통계')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '콩' })).toHaveAttribute(
            'href',
            '/word/search?mode=k&q=콩',
        );
        expect(screen.getAllByText('3')).not.toHaveLength(0);
        expect(screen.getAllByText('2')).not.toHaveLength(0);
    });

    it('filters the selected DTO collection and preserves the existing sort controls', async () => {
        const user = userEvent.setup();
        render(<WordStatsHome />);

        expect(statisticLinks()).toEqual(['나', '가', '다']);

        await user.type(screen.getByPlaceholderText('예: 가'), '가');
        expect(statisticLinks()).toEqual(['가']);

        await user.clear(screen.getByPlaceholderText('예: 가'));
        await user.type(screen.getByPlaceholderText('예: 100'), '12');
        expect(statisticLinks()).toEqual(['나', '다']);

        await user.selectOptions(screen.getAllByRole('combobox')[1], 'letter');
        expect(statisticLinks()).toEqual(['다', '나']);

        await user.click(screen.getByRole('button', { name: '↓' }));
        expect(statisticLinks()).toEqual(['나', '다']);
    });

    it('keeps legacy Supabase and generated database imports out of the screen source', () => {
        const source = readFileSync(
            join(process.cwd(), 'src/app/word/stats/WordStatsHome.tsx'),
            'utf8',
        );

        expect(source).not.toContain('SCM');
        expect(source).not.toContain('database.types');
        expect(source).not.toContain('.from(');
        expect(source).not.toContain('.rpc(');
    });
});
