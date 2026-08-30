import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type { AdminUserListQueryGateway } from '../../application/admin-user-list-ports';
import type {
    AdminUserListItem,
    AdminUserListSort,
    AdminUserRole,
} from '../../application/admin-user-list-types';

interface QueryResponse {
    data?: unknown;
    error?: unknown;
}

interface AdminUserListQuery extends PromiseLike<QueryResponse> {
    order(column: string, options: { ascending: boolean }): AdminUserListQuery;
}

interface AdminUserListQueryBuilder {
    select(columns: string): AdminUserListQuery;
}

interface AdminUserListQueryClient {
    from(table: 'users'): AdminUserListQueryBuilder;
}

const publicInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
});

const roleValues: readonly AdminUserRole[] = ['guest', 'r1', 'r2', 'r3', 'r4', 'admin'];

const sortColumns: Record<AdminUserListSort['field'], string> = {
    contribution: 'contribution',
    monthContribution: 'month_contribution',
    nickname: 'nickname',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonNegativeFiniteNumber = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const normalizeRole = (value: unknown): AdminUserRole => (
    roleValues.includes(value as AdminUserRole) ? value as AdminUserRole : 'guest'
);

const parseItem = (row: unknown): AdminUserListItem | null => {
    if (!isRecord(row)
        || typeof row.id !== 'string'
        || row.id.trim().length === 0
        || typeof row.nickname !== 'string'
        || row.nickname.trim().length === 0
        || !isNonNegativeFiniteNumber(row.contribution)
        || !isNonNegativeFiniteNumber(row.month_contribution)) {
        return null;
    }

    return {
        id: row.id,
        nickname: row.nickname,
        role: normalizeRole(row.role),
        contribution: row.contribution,
        monthContribution: row.month_contribution,
    };
};

const parseResponse = (response: unknown): AdminUserListItem[] | null => {
    if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) return null;

    const items: AdminUserListItem[] = [];
    for (const row of response.data) {
        const item = parseItem(row);
        if (item === null) return null;
        items.push(item);
    }
    return items;
};

/** Supabase users 행을 관리자 사용자 목록 projection으로 안전하게 변환합니다. */
export class SupabaseAdminUserListQueryGateway implements AdminUserListQueryGateway {
    constructor(
        private readonly client: AdminUserListQueryClient = (
            browserSupabaseClient as unknown as AdminUserListQueryClient
        ),
    ) {}

    async loadList(sort: AdminUserListSort): Promise<Result<AdminUserListItem[]>> {
        try {
            const response = await this.client
                .from('users')
                .select('id, nickname, role, contribution, month_contribution')
                .order(sortColumns[sort.field], { ascending: sort.direction === 'asc' });
            const items = parseResponse(response);
            return items === null ? err(publicInfrastructureError()) : ok(items);
        } catch {
            return err(publicInfrastructureError());
        }
    }
}
