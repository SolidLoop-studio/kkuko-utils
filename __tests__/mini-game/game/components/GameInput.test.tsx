import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GameInput from '@/app/mini-game/game/components/GameInput';

describe('GameInput', () => {
    it('should render correctly', () => {
        render(<GameInput />);
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('placeholder', 'Your turn - Input chat');
    });

    it('should handle value change', () => {
        const handleChange = jest.fn();
        render(<GameInput value="test" onChange={handleChange} />);
        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('test');
        fireEvent.change(input, { target: { value: 'new value' } });
        expect(handleChange).toHaveBeenCalled();
    });

    it('should handle key down', () => {
        const handleKeyDown = jest.fn();
        render(<GameInput onKeyDown={handleKeyDown} />);
        const input = screen.getByRole('textbox');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(handleKeyDown).toHaveBeenCalled();
    });

    it('should apply custom class name', () => {
        const { container } = render(<GameInput className="custom-class" />);
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should be readonly when readonly prop is true', () => {
        render(<GameInput readonly />);
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('readonly');
    });

    it('should forward ref', () => {
        const ref = React.createRef<HTMLInputElement>();
        render(<GameInput inputRef={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
});