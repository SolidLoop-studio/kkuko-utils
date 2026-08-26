import {
    SupabaseNotificationListQueryGateway,
    type SupabaseNotificationListQueryClient,
} from '../supabase/supabase-notification-list-query-gateway';

export type ServerNotificationListQueryClient = SupabaseNotificationListQueryClient;

/** 서버 Supabase client로 활성 공지 projection을 조회합니다. */
export class SupabaseServerNotificationListQueryGateway extends SupabaseNotificationListQueryGateway {
    constructor(client: ServerNotificationListQueryClient, clock?: () => Date) {
        super(client, clock);
    }
}
