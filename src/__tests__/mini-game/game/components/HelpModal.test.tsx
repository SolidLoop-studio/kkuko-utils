import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpModal from '@/src/app/mini-game/game/components/HelpModal';

describe('HelpModal', () => {
    it('should render correctly', () => {
        render(<HelpModal onClose={() => {}} />);
        expect(screen.getByText('📖 도움말')).toBeInTheDocument();
        expect(screen.getByText('🎮 게임시작 관련')).toBeInTheDocument();
        expect(screen.getByText('⚙️ 설정 관련')).toBeInTheDocument();
        expect(screen.getByText('🎯 게임중/종료 관련')).toBeInTheDocument();
        expect(screen.getByText('💡 기타 도움말')).toBeInTheDocument();
    });

    it('should close when close button is clicked', () => {
        const onClose = jest.fn();
        render(<HelpModal onClose={onClose} />);
        
        // Header button (×)
        const headerClose = screen.getByText('×');
        fireEvent.click(headerClose);
        expect(onClose).toHaveBeenCalledTimes(1);
        
        // Footer button
        const footerClose = screen.getByText('닫기');
        fireEvent.click(footerClose);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('should close when clicking backdrop', () => {
        const onClose = jest.fn();
        const { container } = render(<HelpModal onClose={onClose} />);
        fireEvent.click(container.firstChild as Element);
        expect(onClose).toHaveBeenCalled();
    });
});