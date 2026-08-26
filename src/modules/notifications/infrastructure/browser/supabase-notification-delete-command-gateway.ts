import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationDeleteCommandGateway } from '../../application/notification-delete-command-ports';

type DeleteResponse = { error: unknown };

export interface NotificationDeleteQuery extends PromiseLike<DeleteResponse> {
    delete(): NotificationDeleteQuery;
    eq(column: 'id', value: number): NotificationDeleteQuery;
}

export interface NotificationDeleteClient {
    from(table: 'notification'): NotificationDeleteQuery;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const deleteError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 삭제에 실패했습니다.',
});

/** 브라우저 Supabase client로 RLS가 적용된 공지 행 하나를 삭제합니다. */
export class SupabaseNotificationDeleteCommandGateway implements NotificationDeleteCommandGateway {
    constructor(
        private readonly client: NotificationDeleteClient = browserSupabaseClient as unknown as NotificationDeleteClient,
    ) {}

    async deleteById(id: number): Promise<Result<void>> {
        try {
            const response = await this.client.from('notification').delete().eq('id', id);
            if (!isRecord(response) || response.error !== null) return err(deleteError());
            return ok(undefined);
        } catch {
            return err(deleteError());
        }
    }
}
