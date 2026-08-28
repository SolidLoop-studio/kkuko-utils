/** 프로필 활동 탭에 안전하게 전달하는 처리 요청 projection입니다. */
export interface ProfileProcessedRequest {
    id: number;
    word: string;
    createdAt: string;
    state: 'pending' | 'approved' | 'rejected';
    requestType: 'add' | 'delete';
}
