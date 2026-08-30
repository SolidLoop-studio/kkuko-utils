import { DeleteNotificationService } from '../../application/delete-notification';
import { GetModalNoticeService } from '../../application/get-modal-notice';
import { SaveNotificationService } from '../../application/save-notification';
import { SupabaseNotificationDeleteCommandGateway } from './supabase-notification-delete-command-gateway';
import { SupabaseNotificationImageReferenceQueryGateway } from './supabase-notification-image-reference-query-gateway';
import { SupabaseNotificationImageStorage } from './supabase-notification-image-storage';
import { SupabaseModalNoticeQueryGateway } from './supabase-modal-notice-query-gateway';
import { SupabaseNotificationWriteCommandGateway } from './supabase-notification-write-command-gateway';

export interface BrowserNotificationServices {
    notificationDeleteService: DeleteNotificationService;
    modalNoticeQueryService: GetModalNoticeService;
    notificationWriteService: SaveNotificationService;
}

/** 브라우저 공지 조회 기능의 application service를 조합합니다. */
export const createBrowserNotificationServices = (): BrowserNotificationServices => {
    const imageStorage = new SupabaseNotificationImageStorage();
    const imageReferences = new SupabaseNotificationImageReferenceQueryGateway();

    return {
        notificationDeleteService: new DeleteNotificationService(
            new SupabaseNotificationDeleteCommandGateway(),
            imageStorage,
            imageReferences,
        ),
        modalNoticeQueryService: new GetModalNoticeService(
            new SupabaseModalNoticeQueryGateway(),
        ),
        notificationWriteService: new SaveNotificationService(
            new SupabaseNotificationWriteCommandGateway(),
            imageStorage,
            imageReferences,
        ),
    };
};
