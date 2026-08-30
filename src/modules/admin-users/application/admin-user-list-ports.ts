import type { Result } from '@/src/shared/application/result';
import type { AdminUserListItem, AdminUserListSort } from './admin-user-list-types';

export interface AdminUserListQueryGateway {
    loadList(sort: AdminUserListSort): Promise<Result<AdminUserListItem[]>>;
}
