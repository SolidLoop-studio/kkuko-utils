import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import {
    SupabaseNotificationImageReferenceQueryGateway as SharedSupabaseNotificationImageReferenceQueryGateway,
    type NotificationImageReferenceQueryClient,
} from '../supabase/supabase-notification-image-reference-query-gateway';

export type {
    NotificationImageReferenceQuery,
    NotificationImageReferenceQueryBuilder,
    NotificationImageReferenceQueryClient,
} from '../supabase/supabase-notification-image-reference-query-gateway';

/** 브라우저 Supabase client를 공유 이미지 참조 adapter에 연결합니다. */
export class SupabaseNotificationImageReferenceQueryGateway
    extends SharedSupabaseNotificationImageReferenceQueryGateway {
    constructor() {
        super(browserSupabaseClient as unknown as NotificationImageReferenceQueryClient);
    }
}
