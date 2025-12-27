import React from 'react';
import { render, screen } from '@testing-library/react';
import GraphBar from '@/app/mini-game/game/components/GraphBar';

describe('GraphBar', () => {
    it('should render correctly', () => {
        render(<GraphBar className="test-class" min={0} max={100} val={50} label="50%" />);
        const bar = screen.getByText('50%');
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveStyle('width: 50%');
    });

    it('should handle custom background color', () => {
        render(<GraphBar className="test-class" val={50} bgc="blue" label="test" />);
        const innerDiv = screen.getByText('test');
        expect(innerDiv.style.backgroundColor).toBe('blue');
    });

    it('should clamp percentage between 0 and 100', () => {
        const { rerender } = render(<GraphBar className="test-class" min={0} max={100} val={-10} label="Low" />);
        expect(screen.getByText('Low')).toHaveStyle({ width: '0%' });
        
        rerender(<GraphBar className="test-class" min={0} max={100} val={150} label="High" />);
        expect(screen.getByText('High')).toHaveStyle({ width: '100%' });
    });

    it('should handle noTransition prop', () => {
        render(<GraphBar className="test-class" val={50} noTransition={true} label="test-trans" />);
        const innerDiv = screen.getByText('test-trans');
        expect(innerDiv).toHaveStyle({ transition: 'none' });
    });
});