/**
 * Notification 도메인 엔티티
 *
 * DB의 `notifications` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface NotificationEntity {
    /** 알림 고유 ID */
    id: number;
    /** 알림 제목 */
    title: string;
    /** 알림 본문 */
    body: string;
    /** 알림 이미지 경로 */
    img: string | null;
    /** 알림 종료 시각 */
    endAt: string;
    /** 중요 알림 여부 */
    isImportant: boolean;
    /** 모달 알림 여부 */
    isModal: boolean;
    /** 생성된 시각 */
    createdAt: string;
}

/**
 * 알림 생성 시 사용하는 입력 타입
 */
export interface NewNotification {
    /** 알림 제목 */
    title: string;
    /** 알림 본문 */
    body: string;
    /** 알림 이미지 경로 */
    img?: string | null;
    /** 알림 종료 시각 */
    endAt: string;
    /** 중요 알림 여부 */
    isImportant?: boolean;
    /** 모달 알림 여부 */
    isModal?: boolean;
}

/**
 * 알림 업데이트 시 사용하는 입력 타입
 */
export interface UpdateNotification {
    /** 알림 제목 */
    title?: string;
    /** 알림 본문 */
    body?: string;
    /** 알림 이미지 경로 */
    img?: string | null;
    /** 알림 종료 시각 */
    endAt: string;
    /** 중요 알림 여부 */
    isImportant?: boolean;
    /** 모달 알림 여부 */
    isModal?: boolean;
}
