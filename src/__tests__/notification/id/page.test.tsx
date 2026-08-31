import { render, screen } from '@testing-library/react';
import { err, ok } from '@/src/shared/application/result';
import type { NotificationDetailProjection } from '@/src/modules/notifications';

const mockGetServerNotificationDetail = jest.fn();
const mockNotFound = jest.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
});
const mockNotificationDetail = jest.fn((_props: unknown) => null);
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

jest.mock('../../../modules/notifications/infrastructure/server/server-notification-services', () => ({
    getServerNotificationDetail: (...args: unknown[]) => mockGetServerNotificationDetail(...args),
}));

jest.mock('next/navigation', () => ({
    notFound: () => mockNotFound(),
}));

jest.mock('../../../app/notification/[id]/NotificationDetail', () => ({
    __esModule: true,
    default: (props: unknown) => mockNotificationDetail(props),
}));

jest.mock('../../../app/components/ErrorPage', () => ({
    __esModule: true,
    default: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

import NotificationDetailPage, {
    generateMetadata,
} from '@/src/app/notification/[id]/page';

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

describe('NotificationDetailPage', () => {
    afterAll(() => mockConsoleError.mockRestore());

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetServerNotificationDetail.mockResolvedValue(ok(projection));
    });

    it('awaits Next.js params and passes the application projection to the detail component', async () => {
        render(await NotificationDetailPage({ params: Promise.resolve({ id: '17' }) }));

        expect(mockGetServerNotificationDetail).toHaveBeenCalledWith(17);
        expect(mockNotificationDetail).toHaveBeenCalledWith({ notification: projection });
    });

    it.each([
        '0',
        '-1',
        '01',
        '1.0',
        '1.5',
        '1e2',
        '0x10',
        '+1',
        ' 1',
        '1 ',
        '12abc',
        String(Number.MAX_SAFE_INTEGER + 1),
    ])('rejects invalid route id %s before loading notification data', async (id) => {
        await expect(NotificationDetailPage({ params: Promise.resolve({ id }) })).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404',
        );
        expect(mockNotFound).toHaveBeenCalledTimes(1);
        expect(mockGetServerNotificationDetail).not.toHaveBeenCalled();
    });

    it('uses the not-found boundary only for a missing notification', async () => {
        mockGetServerNotificationDetail.mockResolvedValue(err({
            kind: 'not-found',
            message: '공지사항을 찾을 수 없습니다.',
        }));

        await expect(NotificationDetailPage({ params: Promise.resolve({ id: '404' }) })).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404',
        );
    });

    it('renders a stable error page for infrastructure failure instead of reporting not-found', async () => {
        mockGetServerNotificationDetail.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        }));

        render(await NotificationDetailPage({ params: Promise.resolve({ id: '17' }) }));

        expect(screen.getByRole('alert')).toHaveTextContent('공지사항을 불러오는 중 오류가 발생했습니다.');
        expect(mockNotFound).not.toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith('공지사항을 불러오는 중 오류가 발생했습니다.');
    });

    it('builds metadata from the same detail projection', async () => {
        await expect(generateMetadata({ params: Promise.resolve({ id: '17' }) })).resolves.toEqual({
            title: '점검 안내 - 공지사항',
            description: '끄코 유틸 공지사항: 점검 안내',
        });
        expect(mockGetServerNotificationDetail).toHaveBeenCalledWith(17);
    });

    it('keeps missing and invalid metadata distinct from infrastructure fallback metadata', async () => {
        mockGetServerNotificationDetail.mockResolvedValueOnce(err({
            kind: 'not-found',
            message: '공지사항을 찾을 수 없습니다.',
        })).mockResolvedValueOnce(err({
            kind: 'infrastructure',
            message: '공지사항을 불러오는 중 오류가 발생했습니다.',
        }));

        await expect(generateMetadata({ params: Promise.resolve({ id: '404' }) })).resolves.toEqual({
            title: '공지사항을 찾을 수 없습니다',
        });
        await expect(generateMetadata({ params: Promise.resolve({ id: '17' }) })).resolves.toEqual({
            title: '공지사항 - 끄코 유틸',
            description: '끄코 유틸의 공지사항입니다.',
        });
    });

    it.each(['0', '01', '1e2', '0x10', '+1', ' 1', '1 ', String(Number.MAX_SAFE_INTEGER + 1)])(
        'returns missing metadata for invalid route id %s without loading notification data',
        async (id) => {
            await expect(generateMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({
                title: '공지사항을 찾을 수 없습니다',
            });
            expect(mockGetServerNotificationDetail).not.toHaveBeenCalled();
        },
    );
});
