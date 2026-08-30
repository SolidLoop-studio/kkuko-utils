import {
    SupabaseNotificationListQueryGateway,
    type SupabaseNotificationListQueryClient,
} from '../supabase/supabase-notification-list-query-gateway';

export type ServerNotificationListQueryClient = SupabaseNotificationListQueryClient;

/** 서버 Supabase client로 전체 공지 목록을 조회합니다. */
export class SupabaseServerNotificationListQueryGateway extends SupabaseNotificationListQueryGateway {
    constructor(client: ServerNotificationListQueryClient) {
        super(client);
    }
}
