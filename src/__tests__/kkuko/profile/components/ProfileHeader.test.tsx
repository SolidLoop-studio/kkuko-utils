import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileHeader from '@/src/app/kkuko/profile/components/ProfileHeader';
import { ProfileData, ItemInfo } from '@/src/app/types/kkuko.types';
import * as profileHelper from '@/src/app/kkuko/profile/utils/profileHelper';

jest.mock('@/app/kkuko/profile/utils/profileHelper');
jest.mock('@/app/kkuko/shared/components/ProfileAvatar', () => () => <div data-testid="profile-avatar" />);
jest.mock('@/app/kkuko/shared/components/TryRenderImg', () => (props: any) => <img alt={props.alt} src={props.url} />);

describe('ProfileHeader', () => {
    const mockProfileData: ProfileData = {
        user: { 
            id: 'test_user', 
            nickname: 'Test Nick', 
            level: 10, 
            exp: 1000, 
            exordial: 'Hello World' 
        },
        equipment: [
            { id: 1, itemId: 'badge1', slot: 'pbdg', stat: {} }
        ],
        presence: { updatedAt: new Date().toISOString() },
        game: {
             win: 10, lose: 5, draw: 0,
             max_combo: 100, max_score: 50000 
        }
    } as any; // Partial mock

    const mockItemsData: ItemInfo[] = [
        { id: 'badge1', name: 'Best Badge', description: '', group: 'pbdg', options: {}, updatedAt: 1 }
    ];

    beforeEach(() => {
        (profileHelper.getNicknameColor as jest.Mock).mockReturnValue('#000000');
        (profileHelper.formatLastSeen as jest.Mock).mockReturnValue('1분 전');
    });

    it('should render user info', () => {
        render(<ProfileHeader profileData={mockProfileData} itemsData={mockItemsData} expRank={1} onRefreshRequest={() => {}} isRefreshing={false} />);
        
        expect(screen.getByText('Test Nick')).toBeInTheDocument();
        expect(screen.getByText('Hello World')).toBeInTheDocument();
        expect(screen.getByText('ID: test_user')).toBeInTheDocument();
        expect(screen.getByText('Lv. 10')).toBeInTheDocument();
        expect(screen.getByText('경험치 랭킹: #1')).toBeInTheDocument();
    });

    it('should render badges', () => {
        render(<ProfileHeader profileData={mockProfileData} itemsData={mockItemsData} expRank={null} onRefreshRequest={() => {}} isRefreshing={false} />);
        
        expect(screen.getByAltText('Best Badge')).toBeInTheDocument();
    });
});
