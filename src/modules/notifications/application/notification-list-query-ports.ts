import type { Result } from '@/src/shared/application/result';
import type { NotificationListItem } from './notification-list-query-types';

export interface NotificationListQueryGateway {
    loadAll(): Promise<Result<NotificationListItem[]>>;
}
