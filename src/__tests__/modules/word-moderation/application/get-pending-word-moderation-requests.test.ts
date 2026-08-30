import { err, ok } from '@/src/shared/application/result';
import { GetPendingWordModerationRequestsService } from '@/src/modules/word-moderation/application/get-pending-word-moderation-requests';
import type { PendingWordModerationRequest } from '@/src/modules/word-moderation/application/pending-word-moderation-query-types';

const requests: PendingWordModerationRequest[] = [{
    requestKey: 'word-request:11',
    id: 11,
    word: '가나',
    requestType: 'add',
    requestedAt: '2026-08-26T00:00:00.000Z',
    requesterId: '00000000-0000-0000-0000-000000000011',
    requesterNickname: '신청자',
    themes: [],
}];

describe('GetPendingWordModerationRequestsService', () => {
    it('returns the stable pending moderation projection from its query gateway', async () => {
        // Break caught: rebuilding persistence rows or changing the projection in Application.
        const loadPending = jest.fn().mockResolvedValue(ok(requests));
        const service = new GetPendingWordModerationRequestsService({ loadPending });

        await expect(service.get()).resolves.toEqual(ok(requests));
        expect(loadPending).toHaveBeenCalledTimes(1);
    });

    it('preserves a stable gateway failure without exposing persistence details', async () => {
        const failure = {
            kind: 'infrastructure' as const,
            message: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
        };
        const loadPending = jest.fn().mockResolvedValue(err(failure));

        await expect(new GetPendingWordModerationRequestsService({ loadPending }).get())
            .resolves.toEqual(err(failure));
    });
});
