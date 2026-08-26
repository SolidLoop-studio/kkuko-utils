import { render, screen } from '@testing-library/react';
import { err, ok } from '@/src/shared/application/result';
import type { NotificationDetailProjection } from '@/src/modules/notifications';

const mockGetServerNotificationDetail = jest.fn();
const mockNotFound = jest.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
});
const mockNotificationWrite = jest.fn((_props: unknown) => null);
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

jest.mock('../../../../modules/notifications/infrastructure/server/server-notification-services', () => ({
    getServerNotificationDetail: (...args: unknown[]) => mockGetServerNotificationDetail(...args),
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
};

describe('NotificationEditPage', () => {
    afterAll(() => mockConsoleError.mockRestore());

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetServerNotificationDetail.mockResolvedValue(ok(projection));
    });

    it('loads the edit initial value through the server notification composition', async () => {
        render(await NotificationEditPage({ params: Promise.resolve({ id: '17' }) }));

        expect(mockGetServerNotificationDetail).toHaveBeenCalledWith(17);
        expect(mockNotificationWrite).toHaveBeenCalledWith({ notification: projection });
    });

    it('uses not-found for invalid or missing notifications', async () => {
        mockGetServerNotificationDetail.mockResolvedValueOnce(err({
            kind: 'validation',
            message: '유효한 공지사항 ID가 필요합니다.',
            field: 'id',
        })).mockResolvedValueOnce(err({
            kind: 'not-found',
            message: '공지사항을 찾을 수 없습니다.',
        }));

        await expect(NotificationEditPage({ params: Promise.resolve({ id: '12abc' }) })).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404',
        );
        await expect(NotificationEditPage({ params: Promise.resolve({ id: '404' }) })).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404',
        );
        expect(mockNotFound).toHaveBeenCalledTimes(2);
    });

    it('renders the stable infrastructure error without using not-found', async () => {
        mockGetServerNotificationDetail.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        }));

        render(await NotificationEditPage({ params: Promise.resolve({ id: '17' }) }));

        expect(screen.getByRole('alert')).toHaveTextContent('공지사항을 불러오는 중 오류가 발생했습니다.');
        expect(mockNotFound).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith('공지사항을 불러오는 중 오류가 발생했습니다.');
    });
});
