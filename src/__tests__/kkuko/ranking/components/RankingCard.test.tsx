import React from 'react';
import { render, screen } from '@testing-library/react';
import { RankingCard } from '@/src/app/kkuko/ranking/components/RankingCard';
import { RankingEntry } from '@/src/app/types/kkuko.types';

describe('RankingCard', () => {
    const mockEntry: RankingEntry = {
        rank: 1,
        userRecord: {
            id: 1,
            userId: 'user1',
            modeId: 'mode1',
            win: 10,
            total: 20,
            exp: 1000,
            playtime: 0
        },
        userInfo: {
            id: 'user1',
            nickname: 'User One',
            level: 5,
            exp: 1000,
            exordial: 'Hello',
            observedAt: ''
        }
    };

    it('should render user info', () => {
        render(<RankingCard entry={mockEntry} option="win" />);
        expect(screen.getByText('User One')).toBeInTheDocument();
        // User ID is not displayed
        // expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText(/Lv\.\s*5\s*•\s*Hello/)).toBeInTheDocument();
    });

    it('should display win rate when option is win', () => {
        render(<RankingCard entry={mockEntry} option="win" />);
        // 10/20 = 50.0%
        expect(screen.getByText('50.0%')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('승리')).toBeInTheDocument();
    });

    it('should display exp when option is exp', () => {
        render(<RankingCard entry={mockEntry} option="exp" />);
        expect(screen.getByText('1,000')).toBeInTheDocument();
        expect(screen.getByText('경험치')).toBeInTheDocument();
    });
});
