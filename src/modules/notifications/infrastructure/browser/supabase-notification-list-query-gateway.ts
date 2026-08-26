import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseNotificationListQueryGateway as SharedSupabaseNotificationListQueryGateway,
    type SupabaseNotificationListQueryClient,
} from '../supabase/supabase-notification-list-query-gateway';

export type NotificationListQueryClient = SupabaseNotificationListQueryClient;

/** 브라우저 Supabase client로 활성 공지 projection을 조회합니다. */
export class SupabaseNotificationListQueryGateway extends SharedSupabaseNotificationListQueryGateway {
    constructor(
        client: NotificationListQueryClient = browserSupabaseClient as unknown as NotificationListQueryClient,
        clock?: () => Date,
    ) {
        super(client, clock);
    }
}
