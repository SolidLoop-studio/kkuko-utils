import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DictionaryModal from '@/app/mini-game/game/components/DictionaryModal';
import gameManager from '@/app/mini-game/game/lib/GameManager';

jest.mock('@/app/mini-game/game/lib/GameManager');

describe('DictionaryModal', () => {
    it('should render correctly', () => {
        render(<DictionaryModal onClose={() => {}} />);
        expect(screen.getByText('사전 검색')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('단어를 입력하세요')).toBeInTheDocument();
    });

    it('should search for a word', () => {
        (gameManager.getWordTheme as jest.Mock).mockReturnValue(['자유']);
        render(<DictionaryModal onClose={() => {}} />);
        
        const input = screen.getByPlaceholderText('단어를 입력하세요');
        fireEvent.change(input, { target: { value: '가방' } });
        fireEvent.click(screen.getByText('검색'));
        
        expect(gameManager.getWordTheme).toHaveBeenCalledWith('가방');
        expect(screen.getByText('주제: 자유')).toBeInTheDocument();
    });

    it('should show message for unknown word', () => {
        (gameManager.getWordTheme as jest.Mock).mockReturnValue([]);
        render(<DictionaryModal onClose={() => {}} />);
        
        const input = screen.getByPlaceholderText('단어를 입력하세요');
        fireEvent.change(input, { target: { value: '없는단어' } });
        fireEvent.click(screen.getByText('검색'));
        
        expect(screen.getByText('없는 단어입니다')).toBeInTheDocument();
    });

    it('should handle enter key', () => {
        (gameManager.getWordTheme as jest.Mock).mockReturnValue(['자유']);
        render(<DictionaryModal onClose={() => {}} />);
        
        const input = screen.getByPlaceholderText('단어를 입력하세요');
        fireEvent.change(input, { target: { value: '가방' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        
        expect(gameManager.getWordTheme).toHaveBeenCalledWith('가방');
    });

    it('should close when close button is clicked', () => {
        const onClose = jest.fn();
        render(<DictionaryModal onClose={onClose} />);
        fireEvent.click(screen.getByText('닫기'));
        expect(onClose).toHaveBeenCalled();
    });
});