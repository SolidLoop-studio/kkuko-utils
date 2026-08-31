'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteNotificationAction } from '@/src/app/notification/actions';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import { notificationQueryKeys } from './notification-query-keys';

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
    const mutation = useMutation<Result<void>, never, number>({
        mutationFn: async (id) => {
            try {
                return await deleteNotificationAction(id);
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
