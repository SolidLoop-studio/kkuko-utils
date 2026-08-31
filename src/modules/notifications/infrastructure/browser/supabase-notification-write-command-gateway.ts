import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseNotificationWriteCommandGateway as SharedSupabaseNotificationWriteCommandGateway,
    type NotificationWriteClient,
} from '../supabase/supabase-notification-write-command-gateway';

export type {
    NotificationWriteClient,
    NotificationWritePayload,
    NotificationWriteQuery,
} from '../supabase/supabase-notification-write-command-gateway';

/** 브라우저 Supabase client를 공유 공지 저장 adapter에 연결합니다. */
export class SupabaseNotificationWriteCommandGateway
    extends SharedSupabaseNotificationWriteCommandGateway {
    constructor() {
        super(browserSupabaseClient as unknown as NotificationWriteClient);
    }
}
