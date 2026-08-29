import type { Result } from '@/src/shared/application/result';

export type DeleteAdminLogsCommand = {
    kind: 'word' | 'docs';
    ids: number[];
};

export interface AdminLogCommandGateway {
    deleteLogs(
        command: DeleteAdminLogsCommand,
    ): Promise<Result<{ deletedIds: number[] }>>;
}
