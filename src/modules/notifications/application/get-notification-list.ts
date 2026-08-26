import type { Result } from '@/src/shared/application/result';
import type { NotificationListQueryGateway } from './notification-list-query-ports';
import type { NotificationListProjection } from './notification-list-query-types';

/** 현재 활성 공지 목록과 최신 모달 공지를 조회합니다. */
export class GetNotificationListService {
    constructor(private readonly gateway: NotificationListQueryGateway) {}

    get(): Promise<Result<NotificationListProjection>> {
        return this.gateway.loadActive();
    }
}
