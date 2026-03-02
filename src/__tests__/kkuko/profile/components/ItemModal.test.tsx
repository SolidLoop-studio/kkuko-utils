import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemModal from '@/src/app/kkuko/profile/components/ItemModal';
import { ItemInfo, ProfileData } from '@/src/app/types/kkuko.types';

jest.mock('@/app/kkuko/shared/components/TryRenderImg', () => () => <div data-testid="item-img" />);
jest.mock('@/app/kkuko/profile/utils/profileHelper', () => ({
    getSlotName: (slot: string) => slot,
    extractColorFromLabel: () => [],
    parseDescription: (desc: string) => [{ text: desc, colorKey: null }],
    getOptionName: (key: string) => key,
    formatNumber: (num: number) => num.toString(),
}));
jest.mock('@/app/kkuko/shared/lib/const', () => ({
    NICKNAME_COLORS: {},
    OPTION_NAMES: { gEXP: '획득 경험치' }
}));

describe('ItemModal', () => {
    const mockProfileData: ProfileData = {
        equipment: [
            { itemId: 'item1', slot: 'head' },
        ],
    } as any;

    const mockItemsData: ItemInfo[] = [
        { 
            id: 'item1', 
            name: 'Cool Hat', 
            image: 'hat.png',
            desc: 'A nice hat',
            options: { gEXP: 0.1 }
        },
    ] as any;

    it('should render items in modal', () => {
        const onClose = jest.fn();
        render(<ItemModal itemsData={mockItemsData} profileData={mockProfileData} onClose={onClose} />);
        
        expect(screen.getByText('장착 아이템 목록')).toBeInTheDocument();
        expect(screen.getByText('Cool Hat')).toBeInTheDocument();
        expect(screen.getByText('gEXP:')).toBeInTheDocument();
        expect(screen.getByText('+10%p')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = jest.fn();
        render(<ItemModal itemsData={mockItemsData} profileData={mockProfileData} onClose={onClose} />);
        
        const closeButtons = screen.getAllByRole('button');
        // Usually the first one or the "X" button.
        fireEvent.click(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
    });
});
