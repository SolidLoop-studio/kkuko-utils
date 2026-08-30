'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { SaveNotificationService } from '../application/save-notification';
import type { NotificationWriteResult } from '../application/notification-write-command-ports';
import type { SaveNotificationCommand } from '../application/notification-write-command-types';
import { createBrowserNotificationServices } from '../infrastructure/browser/browser-notification-services';
import { notificationQueryKeys } from './notification-query-keys';

type NotificationWriteService = Pick<SaveNotificationService, 'save'>;

const saveInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 저장에 실패했습니다.',
});

/** 공지사항 저장 mutation과 성공한 경우의 활성 공지 cache 무효화를 연결합니다. */
export const useSaveNotification = (): {
    saveNotification(command: SaveNotificationCommand): Promise<Result<NotificationWriteResult>>;
    isPending: boolean;
} => {
    const queryClient = useQueryClient();
    const [service] = useState<NotificationWriteService>(() => (
        createBrowserNotificationServices().notificationWriteService
    ));
    const mutation = useMutation<Result<NotificationWriteResult>, never, SaveNotificationCommand>({
        mutationFn: async (command) => {
            try {
                return await service.save(command);
            } catch {
                return err(saveInfrastructureError());
            }
        },
        onSuccess: async (result) => {
            if (result.ok) {
                await queryClient.invalidateQueries({
                    queryKey: notificationQueryKeys.activeList,
                });
            }
        },
    });

    return {
        saveNotification: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
};
