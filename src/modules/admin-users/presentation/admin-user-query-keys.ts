import type { AdminUserListSort } from '../application/admin-user-list-types';

export const adminUserQueryKeys = {
    lists: ['admin-users', 'list'] as const,
    list: (sort: AdminUserListSort) => ['admin-users', 'list', sort] as const,
};
