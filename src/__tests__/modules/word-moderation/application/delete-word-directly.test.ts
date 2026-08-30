import { err, ok, type Result } from '@/src/shared/application/result';
import { DeleteWordDirectlyService } from '@/src/modules/word-moderation/application/delete-word-directly';
import type {
    DeleteWordDirectlyCommand,
    DeleteWordDirectlyResult,
} from '@/src/modules/word-moderation/application/docs-word-moderation-types';
import type { DirectWordDeletionGateway } from '@/src/modules/word-moderation/application/docs-word-moderation-ports';

class FakeDirectDeletionGateway implements DirectWordDeletionGateway {
    calls: DeleteWordDirectlyCommand[] = [];
    result: Result<DeleteWordDirectlyResult> = ok({
        deletedWordCount: 1,
        affectedDocsIds: [2, 4],
    });

    async deleteWord(command: DeleteWordDirectlyCommand): Promise<Result<DeleteWordDirectlyResult>> {
        this.calls.push(command);
        return this.result;
    }
}

describe('DeleteWordDirectlyService', () => {
    it('passes a normalized command to the direct deletion gateway', async () => {
        const gateway = new FakeDirectDeletionGateway();
        const service = new DeleteWordDirectlyService(gateway);

        await expect(service.execute({ wordId: 7 })).resolves.toEqual(ok({
            deletedWordCount: 1,
            affectedDocsIds: [2, 4],
        }));
        expect(gateway.calls).toEqual([{ wordId: 7 }]);
    });

    it('returns validation without calling the direct deletion gateway', async () => {
        const gateway = new FakeDirectDeletionGateway();
        const service = new DeleteWordDirectlyService(gateway);

        await expect(service.execute({ wordId: 0 })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'wordId' },
        });
        expect(gateway.calls).toEqual([]);
    });

    it.each([
        err<DeleteWordDirectlyResult>({ kind: 'conflict', message: 'already deleted' }),
        err<DeleteWordDirectlyResult>({ kind: 'forbidden', message: 'not allowed' }),
        err<DeleteWordDirectlyResult>({ kind: 'infrastructure', message: 'unavailable' }),
    ])('preserves gateway errors', async (gatewayResult) => {
        const gateway = new FakeDirectDeletionGateway();
        gateway.result = gatewayResult;
        const service = new DeleteWordDirectlyService(gateway);

        await expect(service.execute({ wordId: 7 })).resolves.toEqual(gatewayResult);
    });
});
