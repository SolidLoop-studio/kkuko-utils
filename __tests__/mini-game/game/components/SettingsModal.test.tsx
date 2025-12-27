import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '@/app/mini-game/game/components/SettingsModal';
import { soundManager } from '@/app/mini-game/game/lib/SoundManager';

jest.mock('@/app/mini-game/game/lib/SoundManager');

describe('SettingsModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn().mockReturnValue(null),
                setItem: jest.fn(),
            },
            writable: true
        });
    });

    it('should render correctly', () => {
        render(<SettingsModal onClose={() => {}} />);
        expect(screen.getByText('설정')).toBeInTheDocument();
        expect(screen.getByText('효과음/배경음 볼륨')).toBeInTheDocument();
    });

    it('should load volume from localStorage', () => {
        (window.localStorage.getItem as jest.Mock).mockReturnValue('50');
        render(<SettingsModal onClose={() => {}} />);
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should change volume', () => {
        render(<SettingsModal onClose={() => {}} />);
        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '80' } });
        expect(screen.getByText('80%')).toBeInTheDocument();
        expect(soundManager.setAllVolume).toHaveBeenCalledWith(0.8);
    });

    it('should save volume and close', () => {
        const onClose = jest.fn();
        render(<SettingsModal onClose={onClose} />);
        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '80' } });
        
        fireEvent.click(screen.getByText('저장'));
        
        expect(window.localStorage.setItem).toHaveBeenCalledWith('kkutuVolume', '80');
        expect(soundManager.setAllVolume).toHaveBeenCalledWith(0.8);
        expect(onClose).toHaveBeenCalled();
    });

    it('should close without saving when cancel is clicked', () => {
        const onClose = jest.fn();
        render(<SettingsModal onClose={onClose} />);
        fireEvent.click(screen.getByText('취소'));
        expect(onClose).toHaveBeenCalled();
        expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });
});