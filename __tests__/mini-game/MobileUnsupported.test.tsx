import { render, screen, fireEvent } from '@testing-library/react';
import MobileUnsupported from '@/app/mini-game/MobileUnsupported';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

describe('MobileUnsupported', () => {
    const mockBack = jest.fn();

    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue({
            back: mockBack,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the unsupported message correctly', () => {
        render(<MobileUnsupported />);

        expect(screen.getByText('PC 환경에서 이용해주세요')).toBeInTheDocument();
        expect(screen.getByText(/이 게임은 모바일 환경을 지원하지 않습니다/)).toBeInTheDocument();
    });

    it('calls router.back() when back button is clicked', () => {
        render(<MobileUnsupported />);

        const backButton = screen.getByRole('button', { name: /뒤로가기/ });
        fireEvent.click(backButton);

        expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('has the correct CSS classes for mobile visibility', () => {
        const { container } = render(<MobileUnsupported />);
        // The outer div should have md:hidden
        expect(container.firstChild).toHaveClass('md:hidden');
    });
});
