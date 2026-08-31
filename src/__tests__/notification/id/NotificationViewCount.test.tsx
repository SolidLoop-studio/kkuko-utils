import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const mockRecord = jest.fn();

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

jest.mock('../../../modules/notifications/presentation/use-record-notification-view', () => ({
    useRecordNotificationView: () => ({ record: mockRecord }),
}));

jest.mock('lucide-react', () => ({
    Eye: () => <span data-testid="eye-icon" />,
}));

import NotificationViewCount from '@/src/app/notification/[id]/NotificationViewCount';
import { err, ok } from '@/src/shared/application/result';

describe('NotificationViewCount', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRecord.mockResolvedValue(ok(41));
    });

    it('shows the initial value immediately and replaces it with the recorded count once per ID', async () => {
        const { rerender } = render(<NotificationViewCount id={17} initialViews={40} />);

        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('조회수')).toHaveClass('sr-only');
        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('41')).toBeInTheDocument();

        rerender(<NotificationViewCount id={17} initialViews={40} />);
        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));

        mockRecord.mockResolvedValue(ok(8));
        rerender(<NotificationViewCount id={18} initialViews={7} />);
        expect(screen.getByText('7')).toBeInTheDocument();
        await waitFor(() => expect(mockRecord).toHaveBeenCalledWith(18));
        expect(await screen.findByText('8')).toBeInTheDocument();
    });

    it('keeps the initial value visible when recording returns an error Result', async () => {
        mockRecord.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '공지사항 조회 수 기록에 실패했습니다.',
        }));
        render(<NotificationViewCount id={17} initialViews={40} />);

        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
        expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('displays a deferred successful count after StrictMode setup-cleanup-setup without a second record', async () => {
        const deferred = createDeferred<ReturnType<typeof ok<number>>>();
        mockRecord.mockReturnValue(deferred.promise);
        render(
            <StrictMode>
                <NotificationViewCount id={17} initialViews={40} />
            </StrictMode>,
        );

        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
        await act(async () => {
            deferred.resolve(ok(41));
            await deferred.promise;
        });

        expect(screen.getByText('41')).toBeInTheDocument();
    });

    it('ignores a stale first A result after A-to-B-to-A navigation and displays the current A result', async () => {
        const firstA = createDeferred<ReturnType<typeof ok<number>>>();
        const b = createDeferred<ReturnType<typeof ok<number>>>();
        const currentA = createDeferred<ReturnType<typeof ok<number>>>();
        mockRecord
            .mockReturnValueOnce(firstA.promise)
            .mockReturnValueOnce(b.promise)
            .mockReturnValueOnce(currentA.promise);
        const { rerender } = render(<NotificationViewCount id={17} initialViews={40} />);

        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
        rerender(<NotificationViewCount id={18} initialViews={50} />);
        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(2));
        rerender(<NotificationViewCount id={17} initialViews={60} />);
        await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(3));

        await act(async () => {
            firstA.resolve(ok(41));
            await firstA.promise;
        });
        expect(screen.getByText('60')).toBeInTheDocument();

        await act(async () => {
            currentA.resolve(ok(61));
            await currentA.promise;
        });
        expect(screen.getByText('61')).toBeInTheDocument();
    });
});
