'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { DeleteNotificationService } from '../application/delete-notification';
import { createBrowserNotificationServices } from '../infrastructure/browser/browser-notification-services';
import { notificationQueryKeys } from './notification-query-keys';

type NotificationDeleteService = Pick<DeleteNotificationService, 'delete'>;

const deleteInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 삭제에 실패했습니다.',
});

/** 공지사항 삭제 mutation과 성공한 경우의 활성 공지 cache 무효화를 연결합니다. */
export const useDeleteNotification = (): {
    deleteNotification(id: number): Promise<Result<void>>;
    isPending: boolean;
} => {
    const queryClient = useQueryClient();
    const [service] = useState<NotificationDeleteService>(() => (
        createBrowserNotificationServices().notificationDeleteService
    ));
    const mutation = useMutation<Result<void>, never, number>({
        mutationFn: async (id) => {
            try {
                return await service.delete(id);
            } catch {
                return err(deleteInfrastructureError());
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
        deleteNotification: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
};
