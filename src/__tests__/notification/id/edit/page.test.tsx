import { render, screen } from '@testing-library/react';
import { err, ok } from '@/src/shared/application/result';
import type { NotificationDetailProjection } from '@/src/modules/notifications';

const mockGetFreshServerNotificationDetail = jest.fn();
const mockNotFound = jest.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
});
const mockNotificationWrite = jest.fn((_props: unknown) => null);
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

jest.mock('../../../../modules/notifications/infrastructure/server/server-notification-services', () => ({
    getFreshServerNotificationDetail: (...args: unknown[]) => mockGetFreshServerNotificationDetail(...args),
}));

jest.mock('next/navigation', () => ({
    notFound: () => mockNotFound(),
}));

jest.mock('../../../../app/notification/write/NotificationWrite', () => ({
    __esModule: true,
    default: (props: unknown) => mockNotificationWrite(props),
}));

jest.mock('../../../../app/components/ErrorPage', () => ({
    __esModule: true,
    default: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

import NotificationEditPage from '@/src/app/notification/[id]/edit/page';

const projection: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '점검 본문',
    imageUrl: null,
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: false,
    views: 40,
};

describe('NotificationEditPage', () => {
    afterAll(() => mockConsoleError.mockRestore());

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetFreshServerNotificationDetail.mockResolvedValue(ok(projection));
    });

    it('loads the edit initial value through the server notification composition', async () => {
        render(await NotificationEditPage({ params: Promise.resolve({ id: '17' }) }));

        expect(mockGetFreshServerNotificationDetail).toHaveBeenCalledWith(17);
        expect(mockNotificationWrite).toHaveBeenCalledWith({ notification: projection });
    });

    it.each(['01', '1e2', '0x10', '+1', ' 1', '1 ', String(Number.MAX_SAFE_INTEGER + 1)])(
        'rejects invalid edit route id %s before loading notification data',
        async (id) => {
            await expect(NotificationEditPage({ params: Promise.resolve({ id }) })).rejects.toThrow(
                'NEXT_HTTP_ERROR_FALLBACK;404',
            );
            expect(mockGetFreshServerNotificationDetail).not.toHaveBeenCalled();
        },
    );

    it('uses not-found for a missing notification', async () => {
        mockGetFreshServerNotificationDetail.mockResolvedValue(err({
            kind: 'not-found',
            message: '공지사항을 찾을 수 없습니다.',
        }));
        await expect(NotificationEditPage({ params: Promise.resolve({ id: '404' }) })).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404',
        );
        expect(mockNotFound).toHaveBeenCalledTimes(1);
        expect(mockGetFreshServerNotificationDetail).toHaveBeenCalledWith(404);
    });

    it('renders the stable infrastructure error without using not-found', async () => {
        mockGetFreshServerNotificationDetail.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        }));

        render(await NotificationEditPage({ params: Promise.resolve({ id: '17' }) }));

        expect(screen.getByRole('alert')).toHaveTextContent('공지사항을 불러오는 중 오류가 발생했습니다.');
        expect(mockNotFound).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith('공지사항을 불러오는 중 오류가 발생했습니다.');
    });
});
