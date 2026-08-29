import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type {
    AdminLogCommandGateway,
    DeleteAdminLogsCommand,
} from '../../application/admin-log-command-ports';

export interface AdminLogDeleteQuery {
    delete(): AdminLogDeleteQuery;
    in(column: 'id', ids: number[]): AdminLogDeleteQuery;
    select(columns: 'id'): PromiseLike<unknown>;
}

export interface AdminLogDeleteClient {
    from(table: 'logs' | 'docs_logs'): AdminLogDeleteQuery;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const deleteError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
});

const hasExactlyDeletedIds = (response: unknown, expectedIds: number[]): boolean => {
    if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
        return false;
    }

    const returnedIds = response.data.map((row) => (
        isRecord(row) && typeof row.id === 'number' ? row.id : null
    ));
    if (returnedIds.some((id) => id === null || !Number.isSafeInteger(id) || id <= 0)) {
        return false;
    }

    const returnedIdSet = new Set(returnedIds);
    return returnedIds.length === expectedIds.length
        && returnedIdSet.size === expectedIds.length
        && expectedIds.every((id) => returnedIdSet.has(id));
};

/** 브라우저 Supabase client로 선택한 종류의 관리자 로그를 삭제합니다. */
export class SupabaseAdminLogCommandGateway implements AdminLogCommandGateway {
    constructor(
        private readonly client: AdminLogDeleteClient = (
            browserSupabaseClient as unknown as AdminLogDeleteClient
        ),
    ) {}

    async deleteLogs(
        command: DeleteAdminLogsCommand,
    ): Promise<Result<{ deletedIds: number[] }>> {
        try {
            const table = command.kind === 'word' ? 'logs' : 'docs_logs';
            const response: unknown = await this.client
                .from(table)
                .delete()
                .in('id', command.ids)
                .select('id');

            return hasExactlyDeletedIds(response, command.ids)
                ? ok({ deletedIds: [...command.ids] })
                : err(deleteError());
        } catch {
            return err(deleteError());
        }
    }
}
