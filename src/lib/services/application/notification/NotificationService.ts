import type { INotificationRepository, IStorageRepository } from '../../domain/notification/NotificationRepository';
import type { Result, CustomError } from '../../domain/result';
import type { NotificationEntity, NewNotification, UpdateNotification } from '../../domain/notification/NotificationEntity';

/**
 * Notification 유즈케이스 서비스 (Application Layer)
 *
 * 공지 조회/생성/수정/삭제와 이미지 업로드를 담당합니다.
 */
export class NotificationService {
    constructor(
        private readonly notificationRepo: INotificationRepository,
        private readonly storageRepo: IStorageRepository,
    ) {}

    /**
     * 현재 활성 모달 공지를 조회합니다.
     *
     * @returns 활성 모달 공지 또는 null
     */
    async getActiveModal(): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findActiveModal();
    }

    /**
     * 모든 공지를 조회합니다.
     *
     * @returns 공지 엔티티 배열
     */
    async getAll(): Promise<Result<NotificationEntity[], CustomError>> {
        return this.notificationRepo.findAll();
    }

    /**
     * ID로 공지를 조회합니다.
     *
     * @param id - 공지 ID
     * @returns 공지 엔티티 또는 null
     */
    async getById(id: number): Promise<Result<NotificationEntity | null, CustomError>> {
        return this.notificationRepo.findById(id);
    }

    /**
     * 공지를 생성합니다.
     *
     * @param data - 새 공지 입력
     * @returns 생성된 공지 엔티티
     */
    async create(data: NewNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.save(data);
    }

    /**
     * 공지를 수정합니다.
     *
     * @param id - 공지 ID
     * @param data - 수정 데이터
     * @returns 수정된 공지 엔티티
     */
    async update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>> {
        return this.notificationRepo.update(id, data);
    }

    /**
     * 공지를 삭제합니다.
     *
     * @param id - 공지 ID
     * @returns 처리 결과
     */
    async deleteById(id: number): Promise<Result<void, CustomError>> {
        return this.notificationRepo.deleteById(id);
    }

    /**
     * 공지 이미지 파일을 업로드합니다.
     *
     * @param file - 업로드 파일
     * @param path - 저장 경로
     * @returns 공개 URL
     */
    async uploadImage(file: File, path: string): Promise<Result<string, CustomError>> {
        return this.storageRepo.uploadImage(file, path);
    }

    /**
     * 공지 이미지 파일을 삭제합니다.
     *
     * @param path - 저장 경로
     * @returns 처리 결과
     */
    async deleteImage(path: string): Promise<Result<void, CustomError>> {
        return this.storageRepo.deleteImage(path);
    }

    /**
     * 공지 이미지의 공개 URL을 조회합니다.
     *
     * @param path - 저장 경로
     * @returns 공개 URL
     */
    getPublicUrl(path: string): string {
        return this.storageRepo.getPublicUrl(path);
    }
}
