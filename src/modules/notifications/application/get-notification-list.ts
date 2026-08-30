import type { Result } from '@/src/shared/application/result';
import type { NotificationListQueryGateway } from './notification-list-query-ports';
import type { NotificationListItem } from './notification-list-query-types';

/** 종료 여부와 관계없이 전체 공지 목록을 조회합니다. */
export class GetNotificationListService {
    constructor(private readonly gateway: NotificationListQueryGateway) {}

    get(): Promise<Result<NotificationListItem[]>> {
        return this.gateway.loadAll();
    }
}
