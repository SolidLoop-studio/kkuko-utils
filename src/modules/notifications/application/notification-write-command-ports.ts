import type { Result } from '@/src/shared/application/result';
import type { NotificationImageFile } from './notification-write-command-types';

export interface NotificationWriteValues {
    title: string;
    body: string;
    imageUrl: string | null;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
}

export interface NotificationWriteResult {
    id: number;
    imageUrl: string | null;
}

export interface PersistedNotificationWriteResult extends NotificationWriteResult {
    persistedPreviousImageUrl: string | null;
}

export interface NotificationWriteCommandGateway {
    create(values: NotificationWriteValues): Promise<Result<PersistedNotificationWriteResult>>;
    update(
        id: number,
        expectedImageUrl: string | null,
        values: NotificationWriteValues,
    ): Promise<Result<PersistedNotificationWriteResult>>;
}

export interface StoredNotificationImage {
    path: string;
    publicUrl: string;
}

export interface NotificationImageStorage {
    upload(file: NotificationImageFile): Promise<Result<StoredNotificationImage>>;
    remove(path: string): Promise<Result<void>>;
    managedPathFromPublicUrl(publicUrl: string): string | null;
}
