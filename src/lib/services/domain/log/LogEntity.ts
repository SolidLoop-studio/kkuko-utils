/**
 * 단어 로그 엔티티
 */
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

/**
 * 단어 로그 조회 필터
 */
export interface WordLogFilter {
    filterState: 'approved' | 'rejected' | 'pending' | 'all';
    filterType: 'add' | 'delete' | 'all';
    from: number;
    to: number;
}
