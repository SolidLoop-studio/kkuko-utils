import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseNotificationRepository } from './infrastructure/supabase/SupabaseNotificationRepository';
import { SupabaseStorageRepository } from './infrastructure/supabase/SupabaseStorageRepository';
import { NotificationService } from './application/notification/NotificationService';

/**
 * Notification 서비스 컨테이너
 *
 * 공지 및 스토리지 리포지토리를 구성하고 NotificationService를 제공합니다.
 */
export class NotificationServiceContainer {
    public readonly notificationService: NotificationService;

    constructor(supabase: SupabaseClient<Database>) {
        const notificationRepo = new SupabaseNotificationRepository(supabase);
        const storageRepo = new SupabaseStorageRepository(supabase);
        this.notificationService = new NotificationService(notificationRepo, storageRepo);
    }
}

/**
 * NotificationServiceContainer 팩토리
 *
 * @param supabase - Supabase 클라이언트
 * @returns NotificationServiceContainer 인스턴스
 */
export function createNotificationServiceContainer(
    supabase: SupabaseClient<Database>
): NotificationServiceContainer {
    return new NotificationServiceContainer(supabase);
}
