import { err, ok, type Result } from '@/src/shared/application/result';
import { GetDocsWordMutationTargetsService } from '@/src/modules/word-moderation/application/get-docs-word-mutation-targets';
import type {
    GetDocsWordMutationTargetsQuery,
    GetDocsWordMutationTargetsResult,
} from '@/src/modules/word-moderation/application/docs-word-moderation-types';
import type { DocsWordMutationTargetGateway } from '@/src/modules/word-moderation/application/docs-word-moderation-ports';

class FakeTargetGateway implements DocsWordMutationTargetGateway {
    calls: GetDocsWordMutationTargetsQuery[] = [];
    result: Result<GetDocsWordMutationTargetsResult> = ok({ targets: [] });

    async getTargets(query: GetDocsWordMutationTargetsQuery): Promise<Result<GetDocsWordMutationTargetsResult>> {
        this.calls.push(query);
        return this.result;
    }
}

describe('GetDocsWordMutationTargetsService', () => {
    it('passes a normalized query to the target gateway', async () => {
        const gateway = new FakeTargetGateway();
        const service = new GetDocsWordMutationTargetsService(gateway);
        const query: GetDocsWordMutationTargetsQuery = {
            docsId: 4,
            rows: [{ word: '가나다', status: 'add' }],
        };

        await expect(service.get(query)).resolves.toEqual(ok({ targets: [] }));
        expect(gateway.calls).toEqual([query]);
    });

    it('returns validation without calling the target gateway', async () => {
        const gateway = new FakeTargetGateway();
        const service = new GetDocsWordMutationTargetsService(gateway);

        await expect(service.get({ docsId: 0, rows: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'docsId' },
        });
        expect(gateway.calls).toEqual([]);
    });

    it.each([
        err<GetDocsWordMutationTargetsResult>({ kind: 'conflict', message: 'stale rows' }),
        err<GetDocsWordMutationTargetsResult>({ kind: 'forbidden', message: 'not allowed' }),
        err<GetDocsWordMutationTargetsResult>({ kind: 'infrastructure', message: 'unavailable' }),
    ])('preserves gateway errors', async (gatewayResult) => {
        const gateway = new FakeTargetGateway();
        gateway.result = gatewayResult;
        const service = new GetDocsWordMutationTargetsService(gateway);

        await expect(service.get({ docsId: 4, rows: [] })).resolves.toEqual(gatewayResult);
    });
});
