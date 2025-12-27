import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import HistoryHolder from '@/app/mini-game/game/components/HistoryHolder';

describe('HistoryHolder', () => {
    const mockItems = [
        { word: '사과', meaning: '사과나무의 열매', theme: ['fruit'], wordType: 'm1' as const },
        { word: '바나나', meaning: '바나나나무의 열매', theme: ['fruit'], wordType: 'm2' as const },
    ];

    it('should render correctly', () => {
        render(<HistoryHolder historyItems={mockItems} />);
        expect(screen.getByText('사과')).toBeInTheDocument();
        expect(screen.getByText('바나나')).toBeInTheDocument();
    });

    it('should show tooltip on hover', async () => {
        render(<HistoryHolder historyItems={mockItems} />);
        const item = screen.getByText('사과');
        
        await act(async () => {
            fireEvent.mouseEnter(item, { clientX: 100, clientY: 100 });
        });

        // Tooltip content
        const tooltipRoot = document.getElementById('history-tooltip-root');
        expect(tooltipRoot).toBeInTheDocument();
        
        // Use within to check inside the tooltip
        const tooltipContent = within(tooltipRoot!).getByText('사과나무의 열매');
        expect(tooltipContent).toBeInTheDocument();

        await act(async () => {
            fireEvent.mouseLeave(item);
        });

        expect(within(tooltipRoot!).queryByText('사과나무의 열매')).not.toBeInTheDocument();
    });

    it('should handle empty items', () => {
        const { container } = render(<HistoryHolder historyItems={[]} />);
        expect(container.firstChild).toBeInTheDocument();
        expect(screen.queryByText('사과')).not.toBeInTheDocument();
    });
});