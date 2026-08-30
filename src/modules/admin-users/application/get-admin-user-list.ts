import { err, type Result } from '@/src/shared/application/result';
import type { AdminUserListQueryGateway } from './admin-user-list-ports';
import type { AdminUserListItem, AdminUserListSort, AdminUserRole } from './admin-user-list-types';

const publicInfrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
});

const validationError = () => ({
    kind: 'validation' as const,
    message: '올바른 사용자 목록 정렬 조건이 필요합니다.',
});

const roles: readonly AdminUserRole[] = ['guest', 'r1', 'r2', 'r3', 'r4', 'admin'];
const itemKeys = ['id', 'nickname', 'role', 'contribution', 'monthContribution'];
const sortKeys = ['field', 'direction'];

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidSort = (sort: unknown): sort is AdminUserListSort => (
    isRecord(sort)
    && Object.keys(sort).length === sortKeys.length
    && sortKeys.every((key) => Object.prototype.hasOwnProperty.call(sort, key))
    && (sort.field === 'contribution' || sort.field === 'monthContribution' || sort.field === 'nickname')
    && (sort.direction === 'asc' || sort.direction === 'desc')
);

const isValidItem = (item: unknown): item is AdminUserListItem => {
    if (!isRecord(item) || Object.keys(item).length !== itemKeys.length) return false;
    if (!itemKeys.every((key) => Object.prototype.hasOwnProperty.call(item, key))) return false;

    return typeof item.id === 'string'
        && item.id.trim().length > 0
        && typeof item.nickname === 'string'
        && item.nickname.trim().length > 0
        && roles.includes(item.role as AdminUserRole)
        && typeof item.contribution === 'number'
        && Number.isFinite(item.contribution)
        && item.contribution >= 0
        && typeof item.monthContribution === 'number'
        && Number.isFinite(item.monthContribution)
        && item.monthContribution >= 0;
};

/** 관리자 사용자 목록의 정렬과 projection을 검증해 Presentation에 제공합니다. */
export class GetAdminUserListService {
    constructor(private readonly gateway: AdminUserListQueryGateway) {}

    async get(sort: AdminUserListSort): Promise<Result<AdminUserListItem[]>> {
        if (!isValidSort(sort)) return err(validationError());

        try {
            const result = await this.gateway.loadList(sort);
            if (!result.ok || !Array.isArray(result.value) || !result.value.every(isValidItem)) {
                return err(publicInfrastructureError());
            }
            return result;
        } catch {
            return err(publicInfrastructureError());
        }
    }
}
