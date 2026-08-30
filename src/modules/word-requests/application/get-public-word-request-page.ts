import { err, type Result } from '@/src/shared/application/result';
import type { PublicWordRequestPageQueryGateway } from './public-word-request-query-ports';
import {
    PUBLIC_WORD_REQUEST_PAGE_SIZE,
    type PublicWordRequestPageProjection,
    type PublicWordRequestQueryInput,
    type PublicWordRequestStatus,
} from './public-word-request-query-types';

const publicWordRequestError = () => ({
    kind: 'infrastructure' as const,
    message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
});

const isStatus = (value: unknown): value is PublicWordRequestStatus => (
    value === 'all' || value === 'pending' || value === 'approved' || value === 'rejected'
);

const hasSafeRange = (page: number): boolean => {
    const from = (page - 1) * PUBLIC_WORD_REQUEST_PAGE_SIZE;
    const to = page * PUBLIC_WORD_REQUEST_PAGE_SIZE - 1;
    return Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 0 && to >= from;
};

/** 공개 단어 요청 페이지 입력을 검증하고 안전한 projection만 조회합니다. */
export class GetPublicWordRequestPageService {
    constructor(private readonly gateway: PublicWordRequestPageQueryGateway) {}

    async get(input: PublicWordRequestQueryInput): Promise<Result<PublicWordRequestPageProjection>> {
        if (!Number.isSafeInteger(input.page) || input.page < 1 || !hasSafeRange(input.page)) {
            return err({
                kind: 'validation',
                field: 'page',
                message: '페이지 번호가 올바르지 않습니다.',
            });
        }
        if (!isStatus(input.status)) {
            return err({
                kind: 'validation',
                field: 'status',
                message: '요청 상태가 올바르지 않습니다.',
            });
        }

        try {
            const result = await this.gateway.load(input);
            return result.ok ? result : err(publicWordRequestError());
        } catch {
            return err(publicWordRequestError());
        }
    }
}
