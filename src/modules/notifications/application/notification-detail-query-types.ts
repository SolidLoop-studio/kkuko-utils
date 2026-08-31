/** 공지 상세 표시, metadata와 편집 초기값에 공통으로 사용하는 projection입니다. */
export interface NotificationDetailProjection {
    id: number;
    title: string;
    body: string;
    imageUrl: string | null;
    createdAt: string;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
    views: number;
}
