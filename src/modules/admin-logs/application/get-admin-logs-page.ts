import { err, type Result } from '@/src/shared/application/result';
import type { AdminLogsPageQueryGateway } from './admin-logs-page-query-ports';
import type { AdminLogsPageProjection, AdminLogsPageQuery } from './admin-logs-page-query-types';

const publicInfrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '관리자 로그를 불러오는 중 오류가 발생했습니다.',
});

const validationError = () => ({
    kind: 'validation' as const,
    message: '올바른 관리자 로그 조회 조건이 필요합니다.',
});

const isValidDate = (value: string | undefined): boolean => {
    if (value === undefined) return true;
    const datePart = /^\d{4}-\d{2}-\d{2}(?:$|T)/.exec(value)?.[0];
    const timestamp = Date.parse(value);
    return datePart !== undefined
        && !Number.isNaN(timestamp)
        && new Date(timestamp).toISOString().slice(0, 10) === datePart.slice(0, 10);
};

const isValidQuery = (query: AdminLogsPageQuery): boolean => (
    Number.isSafeInteger(query.page)
    && query.page > 0
    && (query.pageSize === 30 || query.pageSize === 150)
    && isValidDate(query.fromDate)
    && isValidDate(query.toDate)
    && (query.fromDate === undefined
        || query.toDate === undefined
        || Date.parse(query.fromDate) <= Date.parse(query.toDate))
);

const matchesQuery = (
    projection: AdminLogsPageProjection,
    query: AdminLogsPageQuery,
): boolean => (
    projection.kind === query.filter.kind
    && projection.page === query.page
    && projection.pageSize === query.pageSize
);

/** 관리자 로그 화면의 필터·페이지 조건을 검증하고 화면 projection을 조회합니다. */
export class GetAdminLogsPageService {
    constructor(private readonly gateway: AdminLogsPageQueryGateway) {}

    async get(query: AdminLogsPageQuery): Promise<Result<AdminLogsPageProjection>> {
        if (!isValidQuery(query)) return err(validationError());

        try {
            const result = await this.gateway.loadPage(query);
            if (!result.ok || !matchesQuery(result.value, query)) {
                return err(publicInfrastructureError());
            }
            return result;
        } catch {
            return err(publicInfrastructureError());
        }
    }
}
