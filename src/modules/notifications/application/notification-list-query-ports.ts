import type { Result } from '@/src/shared/application/result';
import type { NotificationListProjection } from './notification-list-query-types';

export interface NotificationListQueryGateway {
    loadActive(): Promise<Result<NotificationListProjection>>;
}
