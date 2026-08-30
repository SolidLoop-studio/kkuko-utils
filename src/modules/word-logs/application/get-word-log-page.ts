import { err, type Result } from '@/src/shared/application/result';
import type { WordLogQueryGateway } from './word-log-query-ports';
import type { WordLogPageProjection, WordLogPageQuery } from './word-log-query-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '로그를 불러오는 중 오류가 발생했습니다.',
});

const validationError = () => ({
    kind: 'validation' as const,
    message: '올바른 로그 조회 조건이 필요합니다.',
});

const hasSafeInclusiveRange = (query: WordLogPageQuery): boolean => {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    return Number.isSafeInteger(from)
        && from >= 0
        && Number.isSafeInteger(to)
        && to >= from;
};

const isValidQuery = (query: WordLogPageQuery): boolean => (
    Number.isSafeInteger(query.page)
    && query.page > 0
    && query.pageSize === 30
    && (query.state === 'all'
        || query.state === 'approved'
        || query.state === 'rejected'
        || query.state === 'pending')
    && (query.requestType === 'all'
        || query.requestType === 'add'
        || query.requestType === 'delete')
    && hasSafeInclusiveRange(query)
);

const matchesQuery = (
    projection: WordLogPageProjection,
    query: WordLogPageQuery,
): boolean => (
    projection.page === query.page
    && projection.pageSize === query.pageSize
    && Number.isSafeInteger(projection.totalCount)
    && projection.totalCount >= 0
);

/** 공개 단어 로그의 필터와 페이지 범위를 검증한 뒤 화면 projection을 조회합니다. */
export class GetWordLogPageService {
    constructor(private readonly gateway: WordLogQueryGateway) {}

    async get(query: WordLogPageQuery): Promise<Result<WordLogPageProjection>> {
        if (!isValidQuery(query)) return err(validationError());

        try {
            const result = await this.gateway.loadPage(query);
            if (!result.ok || !matchesQuery(result.value, query)) {
                return err(infrastructureError());
            }
            return result;
        } catch {
            return err(infrastructureError());
        }
    }
}
