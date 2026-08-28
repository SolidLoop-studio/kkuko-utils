/** 프로필 활동 탭에 안전하게 전달하는 단어 요청 projection입니다. */
export interface ProfileWordRequest {
    id: number;
    word: string;
    requestType: 'add' | 'delete';
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
}
