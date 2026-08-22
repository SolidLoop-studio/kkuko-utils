import { ManageUserWordRequestsService } from '@/src/modules/word-requests/application/manage-user-word-requests';
import type {
    UserWordRequestCommand,
    UserWordRequestResult,
} from '@/src/modules/word-requests/application/user-word-request-types';
import type { UserWordRequestGateway } from '@/src/modules/word-requests/application/user-word-request-ports';
import { ok, type Result } from '@/src/shared/application/result';

class FakeUserWordRequestGateway implements UserWordRequestGateway {
    requestDeletionResult: Result<UserWordRequestResult> = ok({
        requestId: 11,
        word: '나비',
        requestType: 'delete',
    });
    cancelResult: Result<UserWordRequestResult> = ok({
        requestId: 12,
        word: '가방',
        requestType: 'add',
    });
    requested: UserWordRequestCommand[] = [];
    cancelled: UserWordRequestCommand[] = [];

    async requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        this.requested.push(command);
        return this.requestDeletionResult;
    }

    async cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        this.cancelled.push(command);
        return this.cancelResult;
    }
}

describe('ManageUserWordRequestsService', () => {
    it('passes normalized deletion and cancellation commands to the gateway', async () => {
        const gateway = new FakeUserWordRequestGateway();
        const service = new ManageUserWordRequestsService(gateway);

        await service.requestDeletion({ word: ' 나비 ' });
        await service.cancel({ word: ' 가방 ' });

        expect(gateway.requested).toEqual([{ word: '나비' }]);
        expect(gateway.cancelled).toEqual([{ word: '가방' }]);
    });

    it('does not call the gateway when validation fails', async () => {
        const gateway = new FakeUserWordRequestGateway();
        const service = new ManageUserWordRequestsService(gateway);

        await expect(service.requestDeletion({ word: ' ' })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
        expect(gateway.requested).toEqual([]);
    });
});
