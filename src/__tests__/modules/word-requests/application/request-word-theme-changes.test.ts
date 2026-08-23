import { RequestWordThemeChangesService } from '@/src/modules/word-requests/application/request-word-theme-changes';
import type { UserWordThemeRequestGateway } from '@/src/modules/word-requests/application/user-word-theme-request-ports';
import type {
    RequestWordThemeChangesCommand,
    RequestWordThemeChangesResult,
} from '@/src/modules/word-requests/application/user-word-theme-request-types';
import { ok, type Result } from '@/src/shared/application/result';

class FakeUserWordThemeRequestGateway implements UserWordThemeRequestGateway {
    requested: RequestWordThemeChangesCommand[] = [];
    result: Result<RequestWordThemeChangesResult> = ok({
        word: '나비',
        changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }],
    });

    async requestThemeChanges(command: RequestWordThemeChangesCommand): Promise<Result<RequestWordThemeChangesResult>> {
        this.requested.push(command);
        return this.result;
    }
}

describe('RequestWordThemeChangesService', () => {
    it('forwards only a normalized, sorted theme-change command', async () => {
        const gateway = new FakeUserWordThemeRequestGateway();
        const service = new RequestWordThemeChangesService(gateway);

        await service.execute({
            word: ' 나비 ',
            changes: [
                { themeCode: ' Z ', type: 'delete' },
                { themeCode: 'A', type: 'add' },
            ],
        });

        expect(gateway.requested).toEqual([{
            word: '나비',
            changes: [
                { themeCode: 'A', type: 'add' },
                { themeCode: 'Z', type: 'delete' },
            ],
        }]);
    });

    it('does not call the gateway when validation fails', async () => {
        const gateway = new FakeUserWordThemeRequestGateway();
        const service = new RequestWordThemeChangesService(gateway);

        await expect(service.execute({ word: '나비', changes: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'changes' },
        });
        expect(gateway.requested).toEqual([]);
    });
});
