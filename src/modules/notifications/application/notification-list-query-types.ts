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
