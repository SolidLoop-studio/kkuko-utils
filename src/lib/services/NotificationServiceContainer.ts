import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseNotificationRepository } from './infrastructure/supabase/SupabaseNotificationRepository';
import { SupabaseStorageRepository } from './infrastructure/supabase/SupabaseStorageRepository';
import { NotificationService } from './application/notification/NotificationService';

export class NotificationServiceContainer {
    public readonly notificationService: NotificationService;

    constructor(supabase: SupabaseClient<Database>) {
        const notificationRepo = new SupabaseNotificationRepository(supabase);
        const storageRepo = new SupabaseStorageRepository(supabase);
        this.notificationService = new NotificationService(notificationRepo, storageRepo);
    }
}

export function createNotificationServiceContainer(
    supabase: SupabaseClient<Database>
): NotificationServiceContainer {
    return new NotificationServiceContainer(supabase);
}
