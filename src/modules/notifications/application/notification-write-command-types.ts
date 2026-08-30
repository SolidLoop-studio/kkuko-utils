export interface NotificationImageFile {
    name: string;
    type: string;
    size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export type NotificationImageChange =
    | { kind: 'keep' }
    | { kind: 'remove' }
    | { kind: 'replace'; file: NotificationImageFile };

interface NotificationWriteFields {
    title: string;
    body: string;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
}

export type CreateNotificationCommand = NotificationWriteFields & {
    mode: 'create';
    imageChange: Exclude<NotificationImageChange, { kind: 'remove' }>;
};

export type UpdateNotificationCommand = NotificationWriteFields & {
    mode: 'update';
    id: number;
    expectedImageUrl: string | null;
    imageChange: NotificationImageChange;
};

export type SaveNotificationCommand = CreateNotificationCommand | UpdateNotificationCommand;
