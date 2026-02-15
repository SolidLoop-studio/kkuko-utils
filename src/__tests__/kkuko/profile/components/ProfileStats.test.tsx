import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileStats from '@/src/app/kkuko/profile/components/ProfileStats';
import { ItemInfo } from '@/src/app/types/kkuko.types';
import * as profileHelper from '@/src/app/kkuko/profile/utils/profileHelper';

jest.mock('@/app/kkuko/profile/utils/profileHelper');

describe('ProfileStats', () => {
    const mockItemsData: ItemInfo[] = [
        { id: '1', name: 'Item 1', description: '', group: '', options: { str: 10 }, updatedAt: 1 }
    ];
    const mockOnShowDetail = jest.fn();

    beforeEach(() => {
        (profileHelper.calculateTotalOptions as jest.Mock).mockReturnValue({
            'str': 10000,
            'gEXP': 5000 
        });
        (profileHelper.getOptionName as jest.Mock).mockImplementation((key) => key);
        (profileHelper.formatNumber as jest.Mock).mockImplementation((val) => (val / 1000).toString());
    });

    it('should render total options correctly', () => {
        render(<ProfileStats itemsData={mockItemsData} onShowDetail={mockOnShowDetail} />);
        
        // STR: 10000 -> +10
        expect(screen.getByText('str')).toBeInTheDocument();
        expect(screen.getByText('+10')).toBeInTheDocument();

        // gEXP: 5000 -> +5%p
        expect(screen.getByText('gEXP')).toBeInTheDocument();
        expect(screen.getByText('+5%p')).toBeInTheDocument();
    });

    it('should call onShowDetail when button clicked', () => {
        render(<ProfileStats itemsData={mockItemsData} onShowDetail={mockOnShowDetail} />);
        
        const button = screen.getByRole('button', { name: '보기' });
        fireEvent.click(button);
        
        expect(mockOnShowDetail).toHaveBeenCalled();
    });
});
