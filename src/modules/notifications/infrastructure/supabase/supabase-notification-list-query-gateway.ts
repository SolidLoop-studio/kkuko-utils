import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationListQueryGateway } from '../../application/notification-list-query-ports';
import type { NotificationListItem } from '../../application/notification-list-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface NotificationListQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): NotificationListQueryBuilder;
    order(
        column: 'is_important' | 'created_at' | 'id',
        options: { ascending: boolean },
    ): NotificationListQueryBuilder;
}

export interface SupabaseNotificationListQueryClient {
    from(table: 'notification'): NotificationListQueryBuilder;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseListItem = (value: unknown): NotificationListItem | null => {
    if (!isRecord(value)
        || typeof value.id !== 'number'
        || !Number.isSafeInteger(value.id)
        || value.id <= 0
        || typeof value.title !== 'string'
        || typeof value.created_at !== 'string'
        || Number.isNaN(Date.parse(value.created_at))
        || typeof value.is_important !== 'boolean') {
        return null;
    }

    return {
        id: value.id,
        title: value.title,
        createdAt: value.created_at,
        isImportant: value.is_important,
    };
};

/** 종료 여부와 관계없이 전체 공지 목록을 중요도와 최신순으로 조회합니다. */
export class SupabaseNotificationListQueryGateway implements NotificationListQueryGateway {
    constructor(private readonly client: SupabaseNotificationListQueryClient) {}

    async loadAll(): Promise<Result<NotificationListItem[]>> {
        try {
            const response = await this.client
                .from('notification')
                .select('id, title, created_at, is_important')
                .order('is_important', { ascending: false })
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            const notifications: NotificationListItem[] = [];
            for (const value of response.data) {
                const notification = parseListItem(value);
                if (notification === null) return err(infrastructureError());
                notifications.push(notification);
            }

            return ok(notifications);
        } catch {
            return err(infrastructureError());
        }
    }
}
