import { render, screen } from '@testing-library/react';

jest.mock('react-redux', () => ({
    useSelector: jest.fn(() => ({ role: 'r1' })),
}));

jest.mock('lucide-react', () => ({
    Bell: () => <span />,
    Calendar: () => <span />,
    Megaphone: () => <span />,
    Pin: () => <span />,
    PenSquare: () => <span />,
}));

jest.mock('../../app/components/ui/card', () => ({
    Card: ({ children }: { children: React.ReactNode }) => <article>{children}</article>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
    CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import Notification from '@/src/app/notification/Notification';

describe('Notification', () => {
    it('renders the gateway-owned deterministic order from the list projection', () => {
        render(<Notification notifications={[
            { id: 9, title: '중요 공지', createdAt: '2026-08-26T00:00:00.000Z', isImportant: true },
            { id: 10, title: '일반 공지', createdAt: '2026-08-27T00:00:00.000Z', isImportant: false },
        ]} />);

        expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
            expect.stringContaining('중요 공지'),
            expect.stringContaining('일반 공지'),
        ]);
        expect(screen.getByText('2026-08-26')).toBeInTheDocument();
    });

    it('keeps the existing empty state', () => {
        render(<Notification notifications={[]} />);
        expect(screen.getByText('등록된 공지사항이 없습니다.')).toBeInTheDocument();
    });
});
