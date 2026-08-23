import { ManageUserWordRequestsService } from '@/src/modules/word-requests/application/manage-user-word-requests';
import type {
    RequestWordAdditionCommand,
    RequestWordAdditionResult,
    RequestWordAdditionsCommand,
    RequestWordAdditionsResult,
    UserWordRequestCommand,
    UserWordRequestResult,
} from '@/src/modules/word-requests/application/user-word-request-types';
import type { UserWordRequestGateway } from '@/src/modules/word-requests/application/user-word-request-ports';
import { ok, type Result } from '@/src/shared/application/result';

class FakeUserWordRequestGateway implements UserWordRequestGateway {
    requestAdditionResult: Result<RequestWordAdditionResult> = ok({
        requestId: 10,
        word: '가방',
        requestType: 'add',
        themes: [{ themeCode: 'place', themeName: '지명' }],
    });
    requestAdditionsResult: Result<RequestWordAdditionsResult> = ok({
        requestedWordCount: 2,
        createdWordRequestCount: 1,
        updatedWordRequestCount: 0,
        changedRegisteredWordCount: 1,
        createdThemeChangeRequestCount: 2,
        unchangedWordCount: 0,
    });
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
    additions: RequestWordAdditionCommand[] = [];
    additionBatches: RequestWordAdditionsCommand[] = [];

    async requestAddition(command: RequestWordAdditionCommand): Promise<Result<RequestWordAdditionResult>> {
        this.additions.push(command);
        return this.requestAdditionResult;
    }

    async requestAdditions(command: RequestWordAdditionsCommand): Promise<Result<RequestWordAdditionsResult>> {
        this.additionBatches.push(command);
        return this.requestAdditionsResult;
    }

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
    it('passes a normalized addition command to the gateway', async () => {
        const gateway = new FakeUserWordRequestGateway();
        const service = new ManageUserWordRequestsService(gateway);

        await service.requestAddition({
            word: ' 가방 ',
            themeCodes: [' place ', 'animal'],
        });

        expect(gateway.additions).toEqual([{
            word: '가방',
            themeCodes: ['animal', 'place'],
        }]);
    });

    it('passes a normalized and merged addition batch to the gateway', async () => {
        const gateway = new FakeUserWordRequestGateway();
        const service = new ManageUserWordRequestsService(gateway);

        await service.requestAdditions({
            entries: [
                { word: ' 나비 ', themeCodes: [' place '] },
                { word: '나비', themeCodes: ['animal'] },
                { word: '가방', themeCodes: [] },
            ],
        });

        expect(gateway.additionBatches).toEqual([{
            entries: [
                { word: '가방', themeCodes: [] },
                { word: '나비', themeCodes: ['animal', 'place'] },
            ],
        }]);
    });

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
        await expect(service.requestAddition({ word: '나비', themeCodes: [' ', 'animal'] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'themeCodes' },
        });
        await expect(service.requestAdditions({ entries: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'entries' },
        });
        expect(gateway.requested).toEqual([]);
        expect(gateway.additions).toEqual([]);
        expect(gateway.additionBatches).toEqual([]);
    });
});
