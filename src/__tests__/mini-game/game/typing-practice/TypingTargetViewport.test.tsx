import { act, fireEvent, render, screen } from '@testing-library/react';
import TypingTargetViewport from '@/src/app/mini-game/game/typing-practice/TypingTargetViewport';

const setDimension = (element: Element, property: string, value: number) => {
    Object.defineProperty(element, property, { configurable: true, value });
};

describe('TypingTargetViewport', () => {
    it('renders the full normalized target and progress count', () => {
        const target = '가'.repeat(100);
        const { container } = render(
            <TypingTargetViewport target={target} input={'가'.repeat(37)} isComposing={false} />,
        );

        expect(screen.getByText(target)).toHaveClass('sr-only');
        expect(container.querySelectorAll('[data-testid="typing-target-character"]')).toHaveLength(100);
        expect(screen.getByTestId('typing-target-count')).toHaveTextContent('37 / 100');
    });

    it('preserves committed mismatch and active composition colors', () => {
        const { container } = render(
            <TypingTargetViewport target="단순누진율" input="단수누" isComposing />,
        );
        const characters = container.querySelectorAll('[data-testid="typing-target-character"]');

        expect(characters[0]).toHaveClass('text-green-300');
        expect(characters[1]).toHaveClass('text-red-300', 'underline');
        expect(characters[2]).toHaveClass('text-yellow-200');
    });

    it('centers a fitting target without hidden-edge indicators', () => {
        render(<TypingTargetViewport target="가방" input="" isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[0];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 100);
        setDimension(active, 'offsetLeft', 0);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(viewport).toHaveClass('text-center');
        expect(track).toHaveStyle({ transform: 'translateX(0px)' });
        expect(screen.queryByTestId('typing-target-overflow-start')).not.toBeInTheDocument();
        expect(screen.queryByTestId('typing-target-overflow-end')).not.toBeInTheDocument();
    });

    it('clamps a long target at the start with only the end indicator', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input="" isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[0];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 0);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(0px)' });
        expect(screen.queryByTestId('typing-target-overflow-start')).not.toBeInTheDocument();
        expect(screen.getByTestId('typing-target-overflow-end')).toBeInTheDocument();
    });

    it('moves a long target and exposes both hidden-edge indicators', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input={'가'.repeat(50)} isComposing={false} />);

        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[50];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 1000);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(-866px)' });
        expect(screen.getByTestId('typing-target-overflow-start')).toBeInTheDocument();
        expect(screen.getByTestId('typing-target-overflow-end')).toBeInTheDocument();
    });

    it('clamps a long target at the end with only the start indicator', () => {
        const target = '가'.repeat(100);
        render(<TypingTargetViewport target={target} input={target} isComposing={false} />);
        const viewport = screen.getByTestId('typing-target-viewport');
        const track = screen.getByTestId('typing-target-track');
        const active = track.children[99];
        setDimension(viewport, 'clientWidth', 400);
        setDimension(track, 'scrollWidth', 2000);
        setDimension(active, 'offsetLeft', 1980);
        setDimension(active, 'offsetWidth', 20);

        act(() => fireEvent(window, new Event('resize')));

        expect(track).toHaveStyle({ transform: 'translateX(-1600px)' });
        expect(screen.getByTestId('typing-target-overflow-start')).toBeInTheDocument();
        expect(screen.queryByTestId('typing-target-overflow-end')).not.toBeInTheDocument();
    });
});
