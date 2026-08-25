export type PendingDocsRequest = {
    id: number;
    requestedAt: string;
    docsName: string;
    requesterNickname: string | null;
    requesterId: string | null;
};
