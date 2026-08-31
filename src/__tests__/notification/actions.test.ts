const mockCreateServices = jest.fn();
const mockCreateViewService = jest.fn();
const mockParse = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('../../modules/notifications/infrastructure/server/server-notification-command-services', () => ({
    createServerNotificationCommandServices: () => mockCreateServices(),
    createPublicNotificationViewService: () => mockCreateViewService(),
}));
jest.mock('../../modules/notifications/infrastructure/server/notification-action-input', () => ({
    parseSaveNotificationFormData: (formData: FormData) => mockParse(formData),
}));
jest.mock('next/cache', () => ({ revalidatePath: (path: string) => mockRevalidatePath(path) }));

import { err, ok } from '@/src/shared/application/result';
import {
    deleteNotificationAction,
    recordNotificationViewAction,
    saveNotificationAction,
} from '@/src/app/notification/actions';

const command = {
    mode: 'create' as const,
    title: '점검 안내',
    body: '점검 본문',
    endsAt: '2026-08-31T00:00:00.000Z',
    isImportant: false,
    isModal: false,
    imageChange: { kind: 'keep' as const },
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('notification server actions', () => {
    it('stops a save before parsing or calling the service when unauthorized', async () => {
        const authorize = jest.fn().mockResolvedValue(err({ kind: 'unauthorized', message: '로그인이 필요합니다.' }));
        const save = jest.fn();
        mockCreateServices.mockResolvedValue({ authorize, notificationWriteService: { save } });

        await expect(saveNotificationAction(new FormData())).resolves.toEqual(err({
            kind: 'unauthorized', message: '로그인이 필요합니다.',
        }));
        expect(mockParse).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
    });

    it('stops a deletion before calling the service when unauthorized', async () => {
        const authorize = jest.fn().mockResolvedValue(err({ kind: 'forbidden', message: '공지사항 관리 권한이 없습니다.' }));
        const deleteNotification = jest.fn();
        mockCreateServices.mockResolvedValue({
            authorize,
            notificationDeleteService: { delete: deleteNotification },
        });

        await expect(deleteNotificationAction(17)).resolves.toEqual(err({
            kind: 'forbidden', message: '공지사항 관리 권한이 없습니다.',
        }));
        expect(deleteNotification).not.toHaveBeenCalled();
    });

    it('stops a save before calling the service when form parsing fails', async () => {
        const authorize = jest.fn().mockResolvedValue(ok(undefined));
        const save = jest.fn();
        mockCreateServices.mockResolvedValue({ authorize, notificationWriteService: { save } });
        mockParse.mockReturnValue(err({ kind: 'validation', message: '입력이 올바르지 않습니다.' }));

        await expect(saveNotificationAction(new FormData())).resolves.toEqual(err({
            kind: 'validation', message: '입력이 올바르지 않습니다.',
        }));
        expect(save).not.toHaveBeenCalled();
    });

    it('revalidates only the list after a successful create', async () => {
        const save = jest.fn().mockResolvedValue(ok({ id: 18, imageUrl: null }));
        mockCreateServices.mockResolvedValue({ authorize: jest.fn().mockResolvedValue(ok(undefined)), notificationWriteService: { save } });
        mockParse.mockReturnValue(ok(command));

        await expect(saveNotificationAction(new FormData())).resolves.toEqual(ok({ id: 18, imageUrl: null }));
        expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
        expect(mockRevalidatePath).toHaveBeenCalledWith('/notification');
    });

    it('revalidates the list and detail after a successful update', async () => {
        const save = jest.fn().mockResolvedValue(ok({ id: 17, imageUrl: null }));
        mockCreateServices.mockResolvedValue({ authorize: jest.fn().mockResolvedValue(ok(undefined)), notificationWriteService: { save } });
        mockParse.mockReturnValue(ok({ ...command, mode: 'update', id: 17, expectedImageUrl: null }));

        await saveNotificationAction(new FormData());
        expect(mockRevalidatePath.mock.calls).toEqual([['/notification'], ['/notification/17']]);
    });

    it('revalidates the list and detail only after a successful deletion', async () => {
        const deleteService = { delete: jest.fn().mockResolvedValue(ok(undefined)) };
        mockCreateServices.mockResolvedValue({ authorize: jest.fn().mockResolvedValue(ok(undefined)), notificationDeleteService: deleteService });

        await expect(deleteNotificationAction(17)).resolves.toEqual(ok(undefined));
        expect(mockRevalidatePath.mock.calls).toEqual([['/notification'], ['/notification/17']]);
    });

    it('does not revalidate returned or thrown command failures', async () => {
        const save = jest.fn().mockRejectedValue(new Error('raw save error'));
        const deleteService = { delete: jest.fn().mockResolvedValue(err({ kind: 'infrastructure', message: '공지사항 삭제에 실패했습니다.' })) };
        mockCreateServices
            .mockResolvedValueOnce({ authorize: jest.fn().mockResolvedValue(ok(undefined)), notificationWriteService: { save } })
            .mockResolvedValueOnce({ authorize: jest.fn().mockResolvedValue(ok(undefined)), notificationDeleteService: deleteService });
        mockParse.mockReturnValue(ok(command));

        await expect(saveNotificationAction(new FormData())).resolves.toEqual(err({
            kind: 'infrastructure', message: '공지사항 저장에 실패했습니다.',
        }));
        await deleteNotificationAction(17);
        expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('never revalidates while recording a public view', async () => {
        const record = jest.fn().mockResolvedValue(ok(41));
        mockCreateViewService.mockReturnValue({ record });

        await expect(recordNotificationViewAction(17)).resolves.toEqual(ok(41));
        expect(record).toHaveBeenCalledWith(17);
        expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
});
