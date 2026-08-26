import type { Result } from '@/src/shared/application/result';
import type { NotificationDetailProjection } from './notification-detail-query-types';

export interface NotificationDetailQueryGateway {
    findById(id: number): Promise<Result<NotificationDetailProjection>>;
}
