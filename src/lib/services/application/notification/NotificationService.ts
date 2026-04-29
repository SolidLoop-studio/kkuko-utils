import type { INotificationRepository, IStorageRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import type { NotificationEntity, NewNotification, UpdateNotification } from '../../domain/notification/NotificationEntity';

export class NotificationService {
    constructor(
        private readonly notificationRepo: INotificationRepository,
        private readonly storageRepo: IStorageRepository,
    ) {}

    async getActiveModal(): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findActiveModal();
    }

    async getAll(): Promise<Result<NotificationEntity[], CustomError>> {
        return this.notificationRepo.findAll();
    }

    async getById(id: number): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findById(id);
    }

    async create(data: NewNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.save(data);
    }

    async update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.update(id, data);
    }

    async deleteById(id: number): Promise<Result<void, CustomError>> {
        return this.notificationRepo.deleteById(id);
    }

    async uploadImage(file: File, path: string): Promise<Result<string, CustomError>> {
        return this.storageRepo.uploadImage(file, path);
    }

    async deleteImage(path: string): Promise<Result<void, CustomError>> {
        return this.storageRepo.deleteImage(path);
    }

    getPublicUrl(path: string): string {
        return this.storageRepo.getPublicUrl(path);
    }
}
