import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpModal from '@/src/app/mini-game/game/components/HelpModal';

describe('HelpModal', () => {
    it('should render correctly', () => {
        render(<HelpModal onClose={() => {}} />);
        expect(screen.getByText('📖 도움말')).toBeInTheDocument();
        expect(screen.getByText('🎮 게임시작 관련')).toBeInTheDocument();
        expect(screen.getByText('⚙️ 설정 관련')).toBeInTheDocument();
        expect(screen.getByText('🎯 단어 연습 게임중/종료 관련')).toBeInTheDocument();
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

    it('documents typing practice mode', () => {
        render(<HelpModal onClose={jest.fn()} />);

        expect(screen.getByText('타자 연습 관련')).toBeInTheDocument();
        expect(screen.getAllByText(/WPM/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/분당타자수/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/분당타자수 = 성공 입력 타자수 \/ 경과 시간\(초\) × 60/)).toBeInTheDocument();
        expect(screen.getByText(/WPM = 분당타자수 \/ 5/)).toBeInTheDocument();
        expect(screen.getByText(/정확도 = 정타 글자 수 \/ 입력 글자 수 × 100/)).toBeInTheDocument();
        expect(screen.getByText(/한국어 타자수는 자모 분해 기준/)).toBeInTheDocument();
        expect(screen.getAllByText(/콤보/)).toHaveLength(2);
    });
});
