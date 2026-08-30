export type AdminUserRole = 'guest' | 'r1' | 'r2' | 'r3' | 'r4' | 'admin';

export type AdminUserListSortField = 'contribution' | 'monthContribution' | 'nickname';
export type AdminUserListSortDirection = 'asc' | 'desc';

export interface AdminUserListSort {
    field: AdminUserListSortField;
    direction: AdminUserListSortDirection;
}

export interface AdminUserListItem {
    id: string;
    nickname: string;
    role: AdminUserRole;
    contribution: number;
    monthContribution: number;
}
