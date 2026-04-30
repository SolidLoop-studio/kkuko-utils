export interface WordLogEntity {
    id: number;
    word: string;
    state: 'approved' | 'rejected' | 'pending';
    requestType: 'add' | 'delete';
    madeBy: string | null;
    processedBy: string | null;
    createdAt: string;
    madeByUser: { nickname: string } | null;
    processedByUser: { nickname: string | null } | null;
}

export interface WordLogFilter {
    filterState: 'approved' | 'rejected' | 'pending' | 'all';
    filterType: 'add' | 'delete' | 'all';
    from: number;
    to: number;
}
