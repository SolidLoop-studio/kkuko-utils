import type { Result } from '@/src/shared/application/result';
import type { PendingWordModerationQueryGateway } from './pending-word-moderation-query-ports';
import type { PendingWordModerationRequest } from './pending-word-moderation-query-types';

/** 관리자용 대기 단어 moderation 프로젝션을 조회합니다. */
export class GetPendingWordModerationRequestsService {
    constructor(private readonly gateway: PendingWordModerationQueryGateway) {}

    get(): Promise<Result<PendingWordModerationRequest[]>> {
        return this.gateway.loadPending();
    }
}
