import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseNotificationDeleteCommandGateway as SharedSupabaseNotificationDeleteCommandGateway,
    type NotificationDeleteClient,
} from '../supabase/supabase-notification-delete-command-gateway';

export type {
    NotificationDeleteClient,
    NotificationDeleteQuery,
} from '../supabase/supabase-notification-delete-command-gateway';

/** 브라우저 Supabase client를 공유 공지 삭제 adapter에 연결합니다. */
export class SupabaseNotificationDeleteCommandGateway
    extends SharedSupabaseNotificationDeleteCommandGateway {
    constructor() {
        super(browserSupabaseClient as unknown as NotificationDeleteClient);
    }
}
