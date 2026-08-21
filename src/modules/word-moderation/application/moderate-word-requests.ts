import type { Result } from '@/src/shared/application/result';
import { normalizeWordRequestModerationCommand } from '@/src/modules/word-moderation/domain/word-request-moderation';
import type { WordRequestModerationGateway } from './ports';
import type {
    ModerateWordRequestsCommand,
    WordRequestModerationResult,
} from './word-request-moderation-types';

/** 단어 요청과 기존 단어의 주제 변경을 승인 또는 거부하는 애플리케이션 서비스입니다. */
export class ModerateWordRequestsService {
    constructor(private readonly gateway: WordRequestModerationGateway) {}

    async approve(
        command: ModerateWordRequestsCommand,
    ): Promise<Result<WordRequestModerationResult>> {
        const normalized = normalizeWordRequestModerationCommand(command);
        return normalized.ok ? this.gateway.approve(normalized.value) : normalized;
    }

    async reject(
        command: ModerateWordRequestsCommand,
    ): Promise<Result<WordRequestModerationResult>> {
        const normalized = normalizeWordRequestModerationCommand(command);
        return normalized.ok ? this.gateway.reject(normalized.value) : normalized;
    }
}
