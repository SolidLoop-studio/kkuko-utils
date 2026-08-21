import type { Result } from '@/src/shared/application/result';
import { normalizeDeleteWordDirectlyCommand } from '@/src/modules/word-moderation/domain/docs-word-moderation';
import type { DirectWordDeletionGateway } from './docs-word-moderation-ports';
import type {
    DeleteWordDirectlyCommand,
    DeleteWordDirectlyResult,
} from './docs-word-moderation-types';

/** 등록된 단어를 직접 삭제하는 애플리케이션 서비스입니다. */
export class DeleteWordDirectlyService {
    constructor(private readonly gateway: DirectWordDeletionGateway) {}

    async execute(
        command: DeleteWordDirectlyCommand,
    ): Promise<Result<DeleteWordDirectlyResult>> {
        const normalized = normalizeDeleteWordDirectlyCommand(command);
        return normalized.ok ? this.gateway.deleteWord(normalized.value) : normalized;
    }
}
