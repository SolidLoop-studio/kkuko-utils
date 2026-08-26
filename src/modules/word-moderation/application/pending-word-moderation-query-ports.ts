import type { Result } from '@/src/shared/application/result';
import type { PendingWordModerationRequest } from './pending-word-moderation-query-types';

/** 대기 중인 단어 moderation 요청을 조회하는 저장소 경계입니다. */
export interface PendingWordModerationQueryGateway {
    loadPending(): Promise<Result<PendingWordModerationRequest[]>>;
}
