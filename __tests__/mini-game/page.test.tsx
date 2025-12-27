import { render, screen } from '@testing-library/react';
import MiniGamePage from '@/app/mini-game/page';

// Mock child components
jest.mock('@/app/mini-game/game/Game', () => {
    return function MockGame() {
        return <div data-testid="mock-game">Game Component</div>;
    };
});

jest.mock('@/app/mini-game/MobileUnsupported', () => {
    return function MockMobileUnsupported() {
        return <div data-testid="mock-mobile-unsupported">MobileUnsupported Component</div>;
    };
});

jest.mock('@/app/mini-game/providers', () => {
    return function MockProviders({ children }: { children: React.ReactNode }) {
        return <div data-testid="mock-providers">{children}</div>;
    };
});

describe('MiniGamePage', () => {
    it('renders Game and MobileUnsupported components wrapped in Providers', () => {
        render(<MiniGamePage />);

        expect(screen.getByTestId('mock-providers')).toBeInTheDocument();
        expect(screen.getByTestId('mock-game')).toBeInTheDocument();
        expect(screen.getByTestId('mock-mobile-unsupported')).toBeInTheDocument();
    });

    it('renders Game with desktop visibility classes', () => {
        render(<MiniGamePage />);
        const gameContainer = screen.getByTestId('mock-game').parentElement;
        expect(gameContainer).toHaveClass('hidden');
        expect(gameContainer).toHaveClass('md:flex');
    });
});
