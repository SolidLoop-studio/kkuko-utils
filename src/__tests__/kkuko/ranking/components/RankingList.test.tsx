import React from 'react';
import { render, screen } from '@testing-library/react';
import { RankingList } from '@/src/app/kkuko/ranking/components/RankingList';
import { RankingEntry } from '@/src/app/types/kkuko.types';

// Mock RankingCard to avoid nested complexity
jest.mock('@/app/kkuko/ranking/components/RankingCard', () => ({
    RankingCard: ({ entry }: { entry: RankingEntry }) => (
        <div data-testid="ranking-card">{entry.userInfo.nickname}</div>
    )
}));

describe('RankingList', () => {
    const mockRankings: RankingEntry[] = [
        {
            rank: 1,
            userRecord: { id: 1, userId: '1', modeId: 'm', win: 1, total: 2, exp: 100, playtime: 3600 },
            userInfo: { id: '1', nickname: 'User1', level: 1, exp: 100, exordial: '', observedAt: '' }
        },
        {
            rank: 2,
            userRecord: { id: 2, userId: '2', modeId: 'm', win: 1, total: 2, exp: 100, playtime: 3600 },
            userInfo: { id: '2', nickname: 'User2', level: 1, exp: 100, exordial: '', observedAt: '' }
        },
    ];

    it('should render list of cards', () => {
        render(<RankingList rankings={mockRankings} option="win" />);
        const cards = screen.getAllByTestId('ranking-card');
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveTextContent('User1');
        expect(cards[1]).toHaveTextContent('User2');
    });

    it('should render empty state when no rankings', () => {
        render(<RankingList rankings={[]} option="win" />);
        expect(screen.getByText('랭킹 데이터가 없습니다.')).toBeInTheDocument();
    });
});
