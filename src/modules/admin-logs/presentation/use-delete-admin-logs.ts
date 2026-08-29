'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { docsQueryKeys } from '@/src/modules/docs/presentation/docs-query-keys';
import { identityQueryKeys } from '@/src/modules/identity/presentation/identity-query-keys';
import { wordLogQueryKeys } from '@/src/modules/word-logs/presentation/word-log-query-keys';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type {
    DeleteAdminLogsCommand,
} from '../application/admin-log-command-ports';
import type { DeleteAdminLogsService } from '../application/delete-admin-logs';
import { createBrowserAdminLogsServices } from '../infrastructure/browser/browser-admin-logs-services';
import { adminLogsQueryKeys } from './admin-logs-query-keys';

type DeleteAdminLogsResult = Result<{ deletedIds: number[] }>;

export type AdminLogDeleteService = Pick<DeleteAdminLogsService, 'execute'>;

const deleteInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
});

/** 관리자 로그 선택 삭제와 성공 시 관련 projection cache 무효화를 연결합니다. */
export const useDeleteAdminLogs = (): {
    deleteAdminLogs(command: DeleteAdminLogsCommand): Promise<DeleteAdminLogsResult>;
    isPending: boolean;
} => {
    const queryClient = useQueryClient();
    const [service] = useState<AdminLogDeleteService>(() => (
        createBrowserAdminLogsServices().adminLogDeleteService
    ));
    const pendingPromise = useRef<Promise<DeleteAdminLogsResult> | null>(null);
    const { isPending, mutateAsync } = useMutation<
        DeleteAdminLogsResult,
        never,
        DeleteAdminLogsCommand
    >({
        mutationFn: async (command) => {
            try {
                return await service.execute(command);
            } catch {
                return err(deleteInfrastructureError());
            }
        },
        onSuccess: async (result, command) => {
            if (result.ok) {
                const siblingInvalidation = command.kind === 'word'
                    ? queryClient.invalidateQueries({ queryKey: wordLogQueryKeys.pages })
                    : queryClient.invalidateQueries({
                        predicate: ({ queryKey }) => docsQueryKeys.isLogsQueryKey(queryKey),
                    });

                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: adminLogsQueryKeys.pages }),
                    siblingInvalidation,
                    queryClient.invalidateQueries({
                        queryKey: identityQueryKeys.profileProcessedRequestsRoot,
                    }),
                ]);
            }
        },
    });

    const deleteAdminLogs = useCallback((command: DeleteAdminLogsCommand) => {
        if (pendingPromise.current !== null) return pendingPromise.current;

        const action = mutateAsync(command).finally(() => {
            if (pendingPromise.current === action) pendingPromise.current = null;
        });
        pendingPromise.current = action;
        return action;
    }, [mutateAsync]);

    return { deleteAdminLogs, isPending };
};
