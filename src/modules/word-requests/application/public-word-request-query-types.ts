export const PUBLIC_WORD_REQUEST_PAGE_SIZE = 30;

export type PublicWordRequestStatus = 'all' | 'pending' | 'approved' | 'rejected';

export interface PublicWordRequestQueryInput {
    page: number;
    status: PublicWordRequestStatus;
}

/** 공개 단어 요청 목록 화면에 전달하는 최소 행 projection입니다. */
export interface PublicWordRequestProjection {
    id: number;
    requestType: 'add' | 'delete';
    requestedAt: string;
    requestedBy: string | null;
    status: Exclude<PublicWordRequestStatus, 'all'>;
    word: string;
    wordId: number | null;
    requesterNickname: string | null;
}

/** 공개 단어 요청 목록 화면에 전달하는 페이지 projection입니다. */
export interface PublicWordRequestPageProjection {
    page: number;
    pageSize: typeof PUBLIC_WORD_REQUEST_PAGE_SIZE;
    totalCount: number;
    items: PublicWordRequestProjection[];
}
