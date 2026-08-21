import type { Result } from '@/src/shared/application/result';
import { normalizeDocsWordMutationTargetsQuery } from '@/src/modules/word-moderation/domain/docs-word-moderation';
import type { DocsWordMutationTargetGateway } from './docs-word-moderation-ports';
import type {
    GetDocsWordMutationTargetsQuery,
    GetDocsWordMutationTargetsResult,
} from './docs-word-moderation-types';

/** 문서의 단어 행을 변경 가능한 대상 정보로 조회하는 애플리케이션 서비스입니다. */
export class GetDocsWordMutationTargetsService {
    constructor(private readonly gateway: DocsWordMutationTargetGateway) {}

    async get(
        query: GetDocsWordMutationTargetsQuery,
    ): Promise<Result<GetDocsWordMutationTargetsResult>> {
        const normalized = normalizeDocsWordMutationTargetsQuery(query);
        return normalized.ok ? this.gateway.getTargets(normalized.value) : normalized;
    }
}
