import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type {
    DeletedNotification,
    NotificationDeleteCommandGateway,
} from '../../application/notification-delete-command-ports';

export interface NotificationDeleteQuery {
    delete(): NotificationDeleteQuery;
    eq(column: 'id', value: number): NotificationDeleteQuery;
    select(columns: 'id, img'): NotificationDeleteQuery;
    maybeSingle(): PromiseLike<unknown>;
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

const deletedNotificationFromResponse = (response: unknown): DeletedNotification | null => {
    if (!isRecord(response) || response.error !== null || !isRecord(response.data)) return null;

    const { id, img } = response.data;
    if (!Number.isSafeInteger(id) || typeof id !== 'number' || id <= 0) return null;
    if (typeof img !== 'string' && img !== null) return null;

    return { id, imageUrl: img };
};

/** 브라우저 Supabase client로 RLS가 적용된 공지 행 하나를 삭제합니다. */
export class SupabaseNotificationDeleteCommandGateway implements NotificationDeleteCommandGateway {
    constructor(
        private readonly client: NotificationDeleteClient = browserSupabaseClient as unknown as NotificationDeleteClient,
    ) {}

    async deleteById(id: number): Promise<Result<DeletedNotification>> {
        try {
            const response: unknown = await this.client
                .from('notification')
                .delete()
                .eq('id', id)
                .select('id, img')
                .maybeSingle();
            const deleted = deletedNotificationFromResponse(response);

            return deleted === null ? err(deleteError()) : ok(deleted);
        } catch {
            return err(deleteError());
        }
    }
}
