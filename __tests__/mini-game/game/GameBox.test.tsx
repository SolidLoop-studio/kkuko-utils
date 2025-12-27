import React from 'react';
import { render, screen } from '@testing-library/react';
import GameBox from '@/app/mini-game/game/GameBox';

describe('GameBox', () => {
    it('should render children', () => {
        render(<GameBox><div>Child</div></GameBox>);
        expect(screen.getByText('Child')).toBeInTheDocument();
    });

    it('should have background image', () => {
        const { container } = render(<GameBox><div>Child</div></GameBox>);
        expect(container.firstChild).toHaveClass("bg-[url('/img/gamebg.png')]");
    });
});