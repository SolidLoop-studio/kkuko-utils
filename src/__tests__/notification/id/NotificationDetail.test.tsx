import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSelector } from 'react-redux';
import {
    useDeleteNotification,
    type NotificationDetailProjection,
} from '../../../modules/notifications';
import { err, ok } from '../../../shared/application/result';
import type { ErrorMessage } from '../../../app/types/type';

const mockRouterPush = jest.fn();
const mockRouterRefresh = jest.fn();
const mockDeleteNotification = jest.fn();
let mockIsPending = false;

jest.mock('react-redux', () => ({
    useSelector: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
}));

jest.mock('../../../modules/notifications', () => ({
    useDeleteNotification: jest.fn(),
}));

jest.mock('../../../app/notification/[id]/NotificationViewCount', () => ({
    __esModule: true,
    default: ({ initialViews }: { initialViews: number }) => <span>{initialViews}</span>,
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
    Eye: () => <span />,
}));

jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({ children }: { children: string }) => <p>{children.replaceAll('*', '')}</p>,
}));

jest.mock('../../../app/components/ui/button', () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
}));

jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: ErrorMessage }) => (
        <div role="alert" data-error-message={error.ErrMessage ?? undefined}>
            {JSON.stringify(error)}
        </div>
    ),
}));

jest.mock('../../../app/components/ConfirmModal', () => ({
    __esModule: true,
    default: ({
        open,
        title,
        description,
        onConfirm,
        onClose,
    }: {
        open: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        onClose: () => void;
    }) => open ? (
        <div role="dialog" aria-label="delete confirmation">
            <p>{title}</p>
            <p>{description}</p>
            <button onClick={onClose}>취소</button>
            <button onClick={onConfirm}>확인</button>
        </div>
    ) : null,
}));

jest.mock('../../../app/components/CompleteModal', () => ({
    __esModule: true,
    default: ({
        open,
        title,
        description,
        onClose,
    }: {
        open: boolean;
        title: string;
        description: string;
        onClose: () => void;
    }) => open ? (
        <div role="dialog" aria-label="delete completion">
            <p>{title}</p>
            <p>{description}</p>
            <button onClick={onClose}>완료 닫기</button>
        </div>
    ) : null,
}));

import NotificationDetail from '@/src/app/notification/[id]/NotificationDetail';

const mockedUseSelector = jest.mocked(useSelector);
const mockedUseDeleteNotification = jest.mocked(useDeleteNotification);

const notification: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '**점검 본문**',
    imageUrl: 'https://example.com/notice.png',
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: true,
    views: 40,
};

const openDeleteConfirmation = () => {
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    return screen.getByRole('dialog', { name: 'delete confirmation' });
};

const confirmDelete = () => {
    openDeleteConfirmation();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
};

describe('NotificationDetail', () => {
    beforeEach(() => {
        mockIsPending = false;
        mockedUseSelector.mockReturnValue({ role: 'admin' });
        mockedUseDeleteNotification.mockImplementation(() => ({
            deleteNotification: mockDeleteNotification,
            isPending: mockIsPending,
        }));
        mockDeleteNotification.mockResolvedValue(ok(undefined));
    });

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
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('hides edit and delete controls from non-admin users', () => {
        mockedUseSelector.mockReturnValue({ role: 'r1' });

        render(<NotificationDetail notification={notification} />);

        expect(screen.queryByRole('link', { name: /수정/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    });

    it('opens confirmation and deletes the exact notification once', async () => {
        render(<NotificationDetail notification={notification} />);

        const confirmation = openDeleteConfirmation();
        expect(confirmation).toHaveTextContent('공지사항 삭제');
        expect(confirmation).toHaveTextContent('이 공지사항을 정말 삭제하시겠습니까?');

        fireEvent.click(screen.getByRole('button', { name: '확인' }));

        await waitFor(() => {
            expect(mockDeleteNotification).toHaveBeenCalledTimes(1);
        });
        expect(mockDeleteNotification).toHaveBeenCalledWith(17);
    });

    it('closes confirmation without deleting when the administrator cancels', () => {
        render(<NotificationDetail notification={notification} />);
        openDeleteConfirmation();

        fireEvent.click(screen.getByRole('button', { name: '취소' }));

        expect(screen.queryByRole('dialog', { name: 'delete confirmation' })).not.toBeInTheDocument();
        expect(mockDeleteNotification).not.toHaveBeenCalled();
    });

    it('disables delete and guards confirmation while a deletion is pending', () => {
        const { rerender } = render(<NotificationDetail notification={notification} />);
        openDeleteConfirmation();

        mockIsPending = true;
        rerender(<NotificationDetail notification={notification} />);

        expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        expect(mockDeleteNotification).not.toHaveBeenCalled();
    });

    it('shows the existing completion copy after a successful deletion', async () => {
        render(<NotificationDetail notification={notification} />);

        confirmDelete();

        const completion = await screen.findByRole('dialog', { name: 'delete completion' });
        expect(completion).toHaveTextContent('공지사항이 삭제되었습니다.');
        expect(completion).toHaveTextContent(
            '공지사항이 성공적으로 삭제되었습니다. 목록으로 돌아갑니다.',
        );
    });

    it('shows only the stable application error message when deletion fails', async () => {
        mockDeleteNotification.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '공지사항 삭제에 실패했습니다.',
            cause: {
                message: 'new row violates row-level security policy',
                details: 'private notification table details',
                code: '42501',
            },
        }));
        render(<NotificationDetail notification={notification} />);

        confirmDelete();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveAttribute('data-error-message', '공지사항 삭제에 실패했습니다.');
        expect(alert).toHaveTextContent('Notification Delete Error');
        expect(alert).not.toHaveTextContent('row-level security');
        expect(alert).not.toHaveTextContent('private notification table details');
        expect(alert).not.toHaveTextContent('42501');
    });

    it('navigates to the notification list before refreshing after completion closes', async () => {
        render(<NotificationDetail notification={notification} />);
        confirmDelete();

        fireEvent.click(await screen.findByRole('button', { name: '완료 닫기' }));

        expect(mockRouterPush).toHaveBeenCalledWith('/notification');
        expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
        expect(mockRouterPush.mock.invocationCallOrder[0]).toBeLessThan(
            mockRouterRefresh.mock.invocationCallOrder[0],
        );
    });
});
