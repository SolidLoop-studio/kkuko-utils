import type { Result } from '@/src/shared/application/result';

export interface DeletedNotification {
    id: number;
    imageUrl: string | null;
}

export interface NotificationDeleteCommandGateway {
    deleteById(id: number): Promise<Result<DeletedNotification>>;
}
