export interface NotificationListItem {
    id: number;
    title: string;
    createdAt: string;
    isImportant: boolean;
}

export interface ModalNotice {
    id: number;
    title: string;
    body: string;
    imageUrl: string | null;
    createdAt: string;
    endsAt: string;
}

/** 공지 목록과 최신 모달 공지를 한 번의 활성 공지 조회로 제공하는 화면 projection입니다. */
export interface NotificationListProjection {
    notifications: NotificationListItem[];
    modalNotice: ModalNotice | null;
}
