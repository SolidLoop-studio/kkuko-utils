import { render, screen } from '@testing-library/react';
import type { NotificationDetailProjection } from '@/src/modules/notifications';

jest.mock('react-redux', () => ({
    useSelector: jest.fn(() => ({ role: 'admin' })),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('lucide-react', () => ({
    Calendar: () => <span />,
    ChevronLeft: () => <span />,
    Pin: () => <span />,
    Edit: () => <span />,
    Trash2: () => <span />,
}));

jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({ children }: { children: string }) => <p>{children.replaceAll('*', '')}</p>,
}));

jest.mock('../../../app/components/ErrModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/components/ConfirmModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/components/CompleteModal', () => ({ __esModule: true, default: () => null }));

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: { delete: () => ({ notificationById: jest.fn() }) },
}));

import NotificationDetail from '@/src/app/notification/[id]/NotificationDetail';

const notification: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '**점검 본문**',
    imageUrl: 'https://example.com/notice.png',
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: true,
};

describe('NotificationDetail', () => {
    it('renders the application projection and keeps admin controls', () => {
        render(<NotificationDetail notification={notification} />);

        expect(screen.getByRole('heading', { name: '점검 안내' })).toBeInTheDocument();
        expect(screen.getByText('점검 본문')).toBeInTheDocument();
        expect(screen.getByText('필독')).toBeInTheDocument();
        expect(screen.getByText('팝업 공지')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '점검 안내' })).toHaveAttribute(
            'src',
            'https://example.com/notice.png',
        );
        expect(screen.getByRole('link', { name: /수정/ })).toHaveAttribute(
            'href',
            '/notification/17/edit',
        );
        expect(screen.getByRole('button', { name: /삭제/ })).toBeInTheDocument();
    });
});
