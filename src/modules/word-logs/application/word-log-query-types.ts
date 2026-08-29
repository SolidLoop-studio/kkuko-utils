export type WordLogState = 'approved' | 'rejected' | 'pending';
export type WordLogRequestType = 'add' | 'delete';

export interface WordLogPageQuery {
    page: number;
    pageSize: 30;
    state: WordLogState | 'all';
    requestType: WordLogRequestType | 'all';
}

export interface WordLogPageItem {
    id: number;
    createdAt: string;
    word: string;
    requesterId: string | null;
    processorId: string | null;
    state: WordLogState;
    requestType: WordLogRequestType;
    requesterNickname: string | null;
    processorNickname: string | null;
}

export interface WordLogPageProjection {
    items: WordLogPageItem[];
    totalCount: number;
    page: number;
    pageSize: 30;
}
