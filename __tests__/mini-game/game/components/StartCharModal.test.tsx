import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StartCharModal from '@/app/mini-game/game/components/StartCharModal';

describe('StartCharModal', () => {
    it('should not render when open is false', () => {
        render(<StartCharModal value="" open={false} onClose={() => {}} onChange={() => {}} onSave={() => {}} />);
        expect(screen.queryByText('제시어 시작글자 설정')).not.toBeInTheDocument();
    });

    it('should render correctly when open is true', () => {
        render(<StartCharModal value="가나다" open={true} onClose={() => {}} onChange={() => {}} onSave={() => {}} />);
        expect(screen.getByText('제시어 시작글자 설정')).toBeInTheDocument();
        expect(screen.getByDisplayValue('가나다')).toBeInTheDocument();
    });

    it('should call onChange when typing', () => {
        const onChange = jest.fn();
        render(<StartCharModal value="" open={true} onClose={() => {}} onChange={onChange} onSave={() => {}} />);
        const textarea = screen.getByPlaceholderText('예: 가나다');
        fireEvent.change(textarea, { target: { value: '라' } });
        expect(onChange).toHaveBeenCalledWith('라');
    });

    it('should call onSave when save button is clicked', () => {
        const onSave = jest.fn();
        render(<StartCharModal value="" open={true} onClose={() => {}} onChange={() => {}} onSave={onSave} />);
        fireEvent.click(screen.getByText('저장'));
        expect(onSave).toHaveBeenCalled();
    });

    it('should call onClose when cancel button is clicked', () => {
        const onClose = jest.fn();
        render(<StartCharModal value="" open={true} onClose={onClose} onChange={() => {}} onSave={() => {}} />);
        fireEvent.click(screen.getByText('취소'));
        expect(onClose).toHaveBeenCalled();
    });
});