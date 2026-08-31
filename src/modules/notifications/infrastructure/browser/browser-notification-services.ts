import { GetModalNoticeService } from '../../application/get-modal-notice';
import { SupabaseModalNoticeQueryGateway } from './supabase-modal-notice-query-gateway';

export interface BrowserNotificationServices {
    modalNoticeQueryService: GetModalNoticeService;
}

/** 브라우저 공지 조회 기능의 application service를 조합합니다. */
export const createBrowserNotificationServices = (): BrowserNotificationServices => {
    return {
        modalNoticeQueryService: new GetModalNoticeService(
            new SupabaseModalNoticeQueryGateway(),
        ),
    };
};
