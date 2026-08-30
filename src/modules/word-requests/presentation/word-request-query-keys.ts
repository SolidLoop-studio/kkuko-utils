import type { PublicWordRequestQueryInput } from '../application/public-word-request-query-types';

const publicWordRequestPageRoot = ['word-requests', 'public-page'] as const;

/** 단어 요청 조회의 React Query cache key를 한곳에서 관리합니다. */
export const wordRequestQueryKeys = {
    publicWordRequestPage: (input: PublicWordRequestQueryInput) => [
        ...publicWordRequestPageRoot,
        input.page,
        input.status,
    ] as const,
};
