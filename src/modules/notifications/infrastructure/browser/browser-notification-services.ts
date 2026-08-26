import { DeleteNotificationService } from '../../application/delete-notification';
import { GetNotificationListService } from '../../application/get-notification-list';
import { SaveNotificationService } from '../../application/save-notification';
import { SupabaseNotificationDeleteCommandGateway } from './supabase-notification-delete-command-gateway';
import { SupabaseNotificationImageReferenceQueryGateway } from './supabase-notification-image-reference-query-gateway';
import { SupabaseNotificationImageStorage } from './supabase-notification-image-storage';
import { SupabaseNotificationListQueryGateway } from './supabase-notification-list-query-gateway';
import { SupabaseNotificationWriteCommandGateway } from './supabase-notification-write-command-gateway';

export interface BrowserNotificationServices {
    notificationDeleteService: DeleteNotificationService;
    notificationListQueryService: GetNotificationListService;
    notificationWriteService: SaveNotificationService;
}

/** 브라우저 공지 조회 기능의 application service를 조합합니다. */
export const createBrowserNotificationServices = (): BrowserNotificationServices => ({
    notificationDeleteService: new DeleteNotificationService(
        new SupabaseNotificationDeleteCommandGateway(),
    ),
    notificationListQueryService: new GetNotificationListService(
        new SupabaseNotificationListQueryGateway(),
    ),
    notificationWriteService: new SaveNotificationService(
        new SupabaseNotificationWriteCommandGateway(),
        new SupabaseNotificationImageStorage(),
        new SupabaseNotificationImageReferenceQueryGateway(),
    ),
});
