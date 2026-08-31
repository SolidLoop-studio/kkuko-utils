import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseNotificationImageStorage as SharedSupabaseNotificationImageStorage,
    type NotificationImageStorageClient,
} from '../supabase/supabase-notification-image-storage';

export type {
    NotificationImageStorageBucket,
    NotificationImageStorageClient,
    NotificationImageUploadOptions,
} from '../supabase/supabase-notification-image-storage';

/** 브라우저 Supabase client를 공유 공지 이미지 Storage adapter에 연결합니다. */
export class SupabaseNotificationImageStorage extends SharedSupabaseNotificationImageStorage {
    constructor() {
        super(browserSupabaseClient as unknown as NotificationImageStorageClient);
    }
}
