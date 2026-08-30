import type { Result } from '@/src/shared/application/result';
import type {
    DeleteWordDirectlyCommand,
    DeleteWordDirectlyResult,
    GetDocsWordMutationTargetsQuery,
    GetDocsWordMutationTargetsResult,
} from './docs-word-moderation-types';

export interface DocsWordMutationTargetGateway {
    getTargets(
        query: GetDocsWordMutationTargetsQuery,
    ): Promise<Result<GetDocsWordMutationTargetsResult>>;
}

export interface DirectWordDeletionGateway {
    deleteWord(
        command: DeleteWordDirectlyCommand,
    ): Promise<Result<DeleteWordDirectlyResult>>;
}
