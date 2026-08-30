import type {
    DocsFavoriteCommandGateway,
    SetDocsFavoriteCommand,
} from '@/src/modules/docs/application/docs-favorite-command-ports';
import { SetDocsFavoriteService } from '@/src/modules/docs/application/set-docs-favorite';
import { err, ok, type Result } from '@/src/shared/application/result';

class FakeDocsFavoriteCommandGateway implements DocsFavoriteCommandGateway {
    readonly commands: SetDocsFavoriteCommand[] = [];

    result: Result<void> = ok(undefined);

    async set(command: SetDocsFavoriteCommand): Promise<Result<void>> {
        this.commands.push(command);
        return this.result;
    }
}

describe('SetDocsFavoriteService', () => {
    it.each([true, false])(
        'forwards the desired starred state %p to the command gateway',
        async (isStarred) => {
            // Break caught: toggling or otherwise changing the caller's desired state in Application.
            const gateway = new FakeDocsFavoriteCommandGateway();
            const service = new SetDocsFavoriteService(gateway);
            const command = { docsId: 55, isStarred };

            await expect(service.set(command)).resolves.toEqual(ok(undefined));
            expect(gateway.commands).toEqual([command]);
        },
    );

    it('preserves a gateway failure Result for the presentation boundary', async () => {
        // Break caught: hiding a command failure and allowing the UI to flip favorite state.
        const gateway = new FakeDocsFavoriteCommandGateway();
        gateway.result = err({
            kind: 'not-found',
            message: '문서를 찾을 수 없습니다.',
        });
        const service = new SetDocsFavoriteService(gateway);

        await expect(service.set({ docsId: 55, isStarred: true }))
            .resolves.toEqual(gateway.result);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects invalid docs ID %p before the command gateway',
        async (docsId) => {
            // Break caught: allowing an invalid document identifier to reach the RPC boundary.
            const gateway = new FakeDocsFavoriteCommandGateway();
            const service = new SetDocsFavoriteService(gateway);

            await expect(service.set({ docsId, isStarred: true })).resolves.toEqual(err({
                kind: 'validation',
                message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
            }));
            expect(gateway.commands).toEqual([]);
        },
    );
});
