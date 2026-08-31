'use server';

import { revalidatePath } from 'next/cache';
import type { NotificationWriteResult } from '@/src/modules/notifications';
import {
    createPublicNotificationViewService,
    createServerNotificationCommandServices,
} from '@/src/modules/notifications/infrastructure/server/server-notification-command-services';
import { parseSaveNotificationFormData } from '@/src/modules/notifications/infrastructure/server/notification-action-input';
import { err, type Result } from '@/src/shared/application/result';

const saveInfrastructureError = () => err<NotificationWriteResult>({
    kind: 'infrastructure',
    message: '공지사항 저장에 실패했습니다.',
});

const deleteInfrastructureError = () => err<void>({
    kind: 'infrastructure',
    message: '공지사항 삭제에 실패했습니다.',
});

const viewInfrastructureError = () => err<number>({
    kind: 'infrastructure',
    message: '공지사항 조회 수 기록에 실패했습니다.',
});

export async function recordNotificationViewAction(id: number): Promise<Result<number>> {
    try {
        return await createPublicNotificationViewService().record(id);
    } catch {
        return viewInfrastructureError();
    }
}

export async function saveNotificationAction(
    formData: FormData,
): Promise<Result<NotificationWriteResult>> {
    try {
        const services = await createServerNotificationCommandServices();
        const authorization = await services.authorize();
        if (!authorization.ok) return authorization;

        const command = parseSaveNotificationFormData(formData);
        if (!command.ok) return command;

        const result = await services.notificationWriteService.save(command.value);
        if (result.ok) {
            revalidatePath('/notification');
            if (command.value.mode === 'update') revalidatePath(`/notification/${command.value.id}`);
        }
        return result;
    } catch {
        return saveInfrastructureError();
    }
}

export async function deleteNotificationAction(id: number): Promise<Result<void>> {
    try {
        const services = await createServerNotificationCommandServices();
        const authorization = await services.authorize();
        if (!authorization.ok) return authorization;

        const result = await services.notificationDeleteService.delete(id);
        if (result.ok) {
            revalidatePath('/notification');
            revalidatePath(`/notification/${id}`);
        }
        return result;
    } catch {
        return deleteInfrastructureError();
    }
}
