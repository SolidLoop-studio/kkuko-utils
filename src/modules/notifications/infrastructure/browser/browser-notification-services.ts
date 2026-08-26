import { GetNotificationListService } from '../../application/get-notification-list';
import { SupabaseNotificationListQueryGateway } from './supabase-notification-list-query-gateway';

export interface BrowserNotificationServices {
    notificationListQueryService: GetNotificationListService;
}

/** 브라우저 공지 조회 기능의 application service를 조합합니다. */
export const createBrowserNotificationServices = (): BrowserNotificationServices => ({
    notificationListQueryService: new GetNotificationListService(
        new SupabaseNotificationListQueryGateway(),
    ),
});
