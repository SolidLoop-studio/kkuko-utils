import { DeleteNotificationService } from '../../application/delete-notification';
import { GetNotificationListService } from '../../application/get-notification-list';
import { SupabaseNotificationDeleteCommandGateway } from './supabase-notification-delete-command-gateway';
import { SupabaseNotificationListQueryGateway } from './supabase-notification-list-query-gateway';

export interface BrowserNotificationServices {
    notificationDeleteService: DeleteNotificationService;
    notificationListQueryService: GetNotificationListService;
}

/** 브라우저 공지 조회 기능의 application service를 조합합니다. */
export const createBrowserNotificationServices = (): BrowserNotificationServices => ({
    notificationDeleteService: new DeleteNotificationService(
        new SupabaseNotificationDeleteCommandGateway(),
    ),
    notificationListQueryService: new GetNotificationListService(
        new SupabaseNotificationListQueryGateway(),
    ),
});
