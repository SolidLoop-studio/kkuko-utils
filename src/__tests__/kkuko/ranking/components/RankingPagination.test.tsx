import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RankingPagination } from '@/src/app/kkuko/ranking/components/RankingPagination';

describe('RankingPagination', () => {
    const mockOnPageChange = jest.fn();

    beforeEach(() => {
        mockOnPageChange.mockClear();
    });

    it('should render current page number', () => {
        render(<RankingPagination currentPage={2} onPageChange={mockOnPageChange} hasNextPage={true} />);
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('페이지')).toBeInTheDocument();
    });

    it('should disable prev button on page 1', () => {
        render(<RankingPagination currentPage={1} onPageChange={mockOnPageChange} hasNextPage={true} />);
        // Usually buttons inside are found by role 'button'.
        // There are 2 buttons. Prev and Next.
        const buttons = screen.getAllByRole('button');
        // First button is prev
        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeEnabled();
    });

    it('should call onPageChange when buttons clicked', () => {
        render(<RankingPagination currentPage={2} onPageChange={mockOnPageChange} hasNextPage={true} />);
        const buttons = screen.getAllByRole('button');
        
        // Click prev
        fireEvent.click(buttons[0]);
        expect(mockOnPageChange).toHaveBeenCalledWith(1);

        // Click next
        fireEvent.click(buttons[1]);
        expect(mockOnPageChange).toHaveBeenCalledWith(3);
    });

    it('should disable next button if hasNextPage is false', () => {
        render(<RankingPagination currentPage={2} onPageChange={mockOnPageChange} hasNextPage={false} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons[1]).toBeDisabled();
    });
});
