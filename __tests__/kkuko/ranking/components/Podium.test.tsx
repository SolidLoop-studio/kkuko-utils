import React, { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Podium } from '@/app/kkuko/ranking/components/Podium';
import { RankingEntry, ProfileData } from '@/app/types/kkuko.types';
import * as api from '@/app/kkuko/shared/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/app/kkuko/shared/lib/api');
jest.mock('@/app/kkuko/shared/components/ProfileAvatar', () => () => <div data-testid="profile-avatar" />);

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('Podium', () => {
    const mockEntries: RankingEntry[] = [
        {
            rank: 1,
            userRecord: { id: 1, userId: 'u1', modeId: 'm', win: 10, total: 10, exp: 1000, playtime: 0 },
            userInfo: { id: 'u1', nickname: 'User1', level: 10, exp: 1000, exordial: 'Hi', observedAt: '' }
        },
        {
            rank: 2,
            userRecord: { id: 2, userId: 'u2', modeId: 'm', win: 5, total: 10, exp: 500, playtime: 0 },
            userInfo: { id: 'u2', nickname: 'User2', level: 5, exp: 500, exordial: 'Hello', observedAt: '' }
        },
        {
            rank: 3,
            userRecord: { id: 3, userId: 'u3', modeId: 'm', win: 1, total: 10, exp: 100, playtime: 0 },
            userInfo: { id: 'u3', nickname: 'User3', level: 1, exp: 100, exordial: 'Hey', observedAt: '' }
        }
    ];

    const mockProfileData: ProfileData = {
        equipment: []
    } as any;

    beforeEach(() => {
        (api.fetchProfile as jest.Mock).mockResolvedValue({
            data: { status: 200, data: mockProfileData }
        });
        (api.fetchItems as jest.Mock).mockResolvedValue({
            data: { status: 200, data: [] }
        });
    });

    it('should calculate style correctly', () => {
        // Just checking rendering to ensure no crashes
        render(<Podium topThree={mockEntries} option="win" />, { wrapper: createWrapper() });
        // Wait for effects
    });

    it('should render top 3 users', async () => {
        render(<Podium topThree={mockEntries} option="win" />, { wrapper: createWrapper() });
        
        await waitFor(() => {
            expect(screen.getByText('User1')).toBeInTheDocument();
            expect(screen.getByText('User2')).toBeInTheDocument();
            expect(screen.getByText('User3')).toBeInTheDocument();
        });
    });

    it('should fetch profile data on mount', async () => {
        render(<Podium topThree={mockEntries} option="win" />, { wrapper: createWrapper() });
        
        await waitFor(() => {
            expect(api.fetchProfile).toHaveBeenCalledTimes(3);
        });
    });
});
