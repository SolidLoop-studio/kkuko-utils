import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GameResultModal from '@/app/mini-game/game/components/GameResultModal';

describe('GameResultModal', () => {
    const mockUsedWords = [
        { char: '가', word: '가방', missionChar: null, useHintCount: 0 },
        { char: '방', word: '방구', missionChar: '구', useHintCount: 1 },
        { char: '구', word: '구슬', missionChar: null, useHintCount: 0, isFailed: true }
    ];

    it('should render correctly', () => {
        render(<GameResultModal usedWords={mockUsedWords} onClose={() => {}} />);
        expect(screen.getByText('🎮 게임 결과')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // Total count
        expect(screen.getByText('가방')).toBeInTheDocument();
        expect(screen.getByText('방구')).toBeInTheDocument();
        expect(screen.getByText('구슬')).toBeInTheDocument();
        expect(screen.getByText('미션: 구')).toBeInTheDocument();
        expect(screen.getByText('힌트 1회')).toBeInTheDocument();
        expect(screen.getByText('입력 실패')).toBeInTheDocument();
    });

    it('should handle minimize/maximize', () => {
        render(<GameResultModal usedWords={mockUsedWords} onClose={() => {}} />);
        
        // Minimize
        const minimizeBtn = screen.getByTitle('최소화');
        fireEvent.click(minimizeBtn);
        
        expect(screen.queryByText('가방')).not.toBeInTheDocument();
        expect(screen.getByText('총 3개의 단어 사용')).toBeInTheDocument();
        
        // Maximize
        const maximizeBtn = screen.getByTitle('펼치기');
        fireEvent.click(maximizeBtn);
        
        expect(screen.getByText('가방')).toBeInTheDocument();
    });

    it('should close when close button is clicked', () => {
        const onClose = jest.fn();
        render(<GameResultModal usedWords={mockUsedWords} onClose={onClose} />);
        fireEvent.click(screen.getByTitle('닫기'));
        expect(onClose).toHaveBeenCalled();
    });

    it('should show empty message if no words used', () => {
        render(<GameResultModal usedWords={[]} onClose={() => {}} />);
        expect(screen.getByText('사용한 단어가 없습니다.')).toBeInTheDocument();
    });
});