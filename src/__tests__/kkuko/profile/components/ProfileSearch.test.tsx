import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileSearch from '@/src/app/kkuko/profile/components/ProfileSearch';
import { useRouter, useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe('ProfileSearch', () => {
    const mockRouter = { push: jest.fn(), replace: jest.fn() };
    const mockSearchParams = { get: jest.fn() };
    const mockOnRemoveRecentSearch = jest.fn();
    const mockOnSearch = jest.fn();

    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
        (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
        mockRouter.push.mockClear();
        mockRouter.replace.mockClear();
        mockSearchParams.get.mockClear();
        mockOnRemoveRecentSearch.mockClear();
        mockOnSearch.mockClear();
    });

    it('should render search input and button', () => {
        const { container } = render(<ProfileSearch loading={false} recentSearches={[]} onRemoveRecentSearch={mockOnRemoveRecentSearch} onSearch={mockOnSearch} />);
        expect(screen.getByPlaceholderText('유저 검색...')).toBeInTheDocument();
        // search button check
        const button = container.querySelector('button.bg-blue-500');
        expect(button).toBeInTheDocument();
    });

    it('should change search type', () => {
        render(<ProfileSearch loading={false} recentSearches={[]} onRemoveRecentSearch={mockOnRemoveRecentSearch} onSearch={mockOnSearch} />);
        // By default 'nick' is selected (label usually '닉네임')
        // const select = screen.getByRole('combobox'); // If it is a select
        // Or buttons if it's a toggle.
        // Let's assume there is a select element based on typical UI or check code more deeply if needed.
        // Reading code... `const [searchType, setSearchType] = useState<'nick' | 'id'>('nick');`
        // It likely uses a select dropdown.
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'id' } });
        expect(select).toHaveValue('id');
    });

    it('should submit search', () => {
        const { container } = render(<ProfileSearch loading={false} recentSearches={[]} onRemoveRecentSearch={mockOnRemoveRecentSearch} onSearch={mockOnSearch} />);
        const input = screen.getByPlaceholderText('유저 검색...');
        fireEvent.change(input, { target: { value: 'testuser' } });
        
        const button = container.querySelector('button.bg-blue-500');
        if (button) {
            fireEvent.click(button);
        } else {
            throw new Error('Search button not found');
        }

        expect(mockOnSearch).toHaveBeenCalledWith('testuser', 'nick');
    });

    it('should show recent searches on focus', () => {
        const recentSearches = [{ query: 'past', type: 'nick', timestamp: 123 } as any];
        render(<ProfileSearch loading={false} recentSearches={recentSearches} onRemoveRecentSearch={mockOnRemoveRecentSearch} onSearch={mockOnSearch} />);
        
        const input = screen.getByPlaceholderText('유저 검색...');
        fireEvent.focus(input);
        
        expect(screen.getByText('past')).toBeInTheDocument();
    });
});
