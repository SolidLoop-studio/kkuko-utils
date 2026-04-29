/**
 * Notification 도메인 엔티티
 *
 * DB의 `notifications` 테이블 Row를 도메인 관점에서 표현한 타입입니다.
 */
export interface NotificationEntity {
    /** 공지 고유 ID */
    id: number;
    /** 공지 제목 */
    title: string;
    /** 공지 본문 */
    body: string;
    /** 공지 이미지 경로 */
    img: string | null;
    /** 공지 종료 시각 */
    endAt: string;
    /** 중요 공지 여부 */
    isImportant: boolean;
    /** 모달 공지 여부 */
    isModal: boolean;
    /** 생성된 시각 */
    createdAt: string;
}

/**
 * 공지 생성 시 사용하는 입력 타입
 */
export interface NewNotification {
    /** 공지 제목 */
    title: string;
    /** 공지 본문 */
    body: string;
    /** 공지 이미지 경로 */
    img?: string | null;
    /** 공지 종료 시각 */
    endAt: string;
    /** 중요 공지 여부 */
    isImportant?: boolean;
    /** 모달 공지 여부 */
    isModal?: boolean;
}

/**
 * 공지 업데이트 시 사용하는 입력 타입
 */
export interface UpdateNotification {
    /** 공지 제목 */
    title?: string;
    /** 공지 본문 */
    body?: string;
    /** 공지 이미지 경로 */
    img?: string | null;
    /** 공지 종료 시각 */
    endAt: string;
    /** 중요 공지 여부 */
    isImportant?: boolean;
    /** 모달 공지 여부 */
    isModal?: boolean;
}
