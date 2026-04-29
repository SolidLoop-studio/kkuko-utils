export type RoleLevel = 'r1' | 'r2' | 'r3' | 'r4' | 'admin';
export type UserSortField = 'contribution' | 'month_contribution' | 'nickname';

export interface UserEntity {
    id: string;
    nickname: string;
    role: RoleLevel;
    contribution: number;
    monthContribution: number;
}

export interface UserStarredDocs {
    userId: string;
    docsId: number;
    createdAt: string;
    docs: { id: number; name: string; typez: string };
}

export interface UserMonthlyContribution {
    id: number;
    userId: string;
    month: string;
    contribution: number;
}

export interface UserWaitWordRequest {
    id: number;
    word: string;
    requestType: 'add' | 'delete';
    requestedAt: string;
}

export interface UserWordLog {
    id: number;
    word: string;
    rType: 'add' | 'delete';
    state: 'approved' | 'rejected' | 'pending';
    createdAt: string;
}
