import type { Result, CustomError } from '../result';
import type { NotificationEntity, NewNotification, UpdateNotification } from './NotificationEntity';

/**
 * Notification 저장소 인터페이스
 *
 * 알림 데이터를 조회, 생성, 업데이트, 삭제하는 책임을 정의합니다.
 */
export interface INotificationRepository {
    /**
     * 모든 알림을 조회합니다.
     * @returns 알림 목록 또는 에러
     */
    findAll(): Promise<Result<NotificationEntity[], CustomError>>;

    /**
     * ID로 알림을 조회합니다.
     * @param id 알림 ID
     * @returns 알림 또는 null, 또는 에러
     */
    findById(id: number): Promise<Result<NotificationEntity | null, CustomError>>;

    /**
     * 활성 모달 알림을 조회합니다 (isModal=true, endAt이 현재 시각보다 이후).
     * @returns 활성 모달 알림 또는 null, 또는 에러
     */
    findActiveModal(): Promise<Result<NotificationEntity | null, CustomError>>;

    /**
     * 새로운 알림을 저장합니다.
     * @param data 생성할 알림 데이터
     * @returns 생성된 알림 또는 에러
     */
    save(data: NewNotification): Promise<Result<NotificationEntity, CustomError>>;

    /**
     * 알림을 업데이트합니다.
     * @param id 알림 ID
     * @param data 업데이트할 알림 데이터
     * @returns 업데이트된 알림 또는 에러
     */
    update(id: number, data: UpdateNotification): Promise<Result<NotificationEntity, CustomError>>;

    /**
     * 알림을 삭제합니다.
     * @param id 알림 ID
     * @returns 삭제 결과 또는 에러
     */
    deleteById(id: number): Promise<Result<void, CustomError>>;
}

/**
 * Storage (파일 업로드) 저장소 인터페이스
 *
 * 알림 이미지 파일을 업로드, 삭제, URL 조회하는 책임을 정의합니다.
 */
export interface IStorageRepository {
    /**
     * 파일을 업로드합니다.
     * @param file 업로드할 파일
     * @param path 저장할 경로
     * @returns 파일 경로 또는 에러
     */
    uploadImage(file: File, path: string): Promise<Result<string, CustomError>>;

    /**
     * 파일을 삭제합니다.
     * @param path 삭제할 파일 경로
     * @returns 삭제 결과 또는 에러
     */
    deleteImage(path: string): Promise<Result<void, CustomError>>;

    /**
     * 공개 URL을 조회합니다.
     * @param path 파일 경로
     * @returns 공개 URL
     */
    getPublicUrl(path: string): string;
}
