import { err, ok, type Result } from '@/src/shared/application/result';
import { ModerateWordRequestsService } from '@/src/modules/word-moderation/application/moderate-word-requests';
import type {
    ModerateWordRequestsCommand,
    WordRequestModerationResult,
} from '@/src/modules/word-moderation/application/word-request-moderation-types';
import type { WordRequestModerationGateway } from '@/src/modules/word-moderation/application/ports';

const result: WordRequestModerationResult = {
    processedWordRequestCount: 1,
    processedThemeChangeCount: 1,
    affectedDocsIds: [2, 8],
};

const command: ModerateWordRequestsCommand = {
    selections: [
        { kind: 'theme-change', wordId: 9, changes: [{ themeId: 4, type: 'delete' }] },
        { kind: 'word-request', requestId: 3, selectedThemeIds: [8, 2, 8] },
    ],
};

class FakeWordRequestModerationGateway implements WordRequestModerationGateway {
    approveResult: Result<WordRequestModerationResult> = ok(result);
    rejectResult: Result<WordRequestModerationResult> = ok(result);
    readonly approvedCommands: ModerateWordRequestsCommand[] = [];
    readonly rejectedCommands: ModerateWordRequestsCommand[] = [];

    async approve(value: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        this.approvedCommands.push(value);
        return this.approveResult;
    }

    async reject(value: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        this.rejectedCommands.push(value);
        return this.rejectResult;
    }
}

const normalizedCommand: ModerateWordRequestsCommand = {
    selections: [
        { kind: 'word-request', requestId: 3, selectedThemeIds: [2, 8] },
        { kind: 'theme-change', wordId: 9, changes: [{ themeId: 4, type: 'delete' }] },
    ],
};

describe('ModerateWordRequestsService', () => {
    it('passes a normalized approval command to the gateway', async () => {
        const gateway = new FakeWordRequestModerationGateway();
        const service = new ModerateWordRequestsService(gateway);

        await expect(service.approve(command)).resolves.toEqual(ok(result));
        expect(gateway.approvedCommands).toEqual([normalizedCommand]);
    });

    it('passes a normalized rejection command to the gateway', async () => {
        const gateway = new FakeWordRequestModerationGateway();
        const service = new ModerateWordRequestsService(gateway);

        await expect(service.reject(command)).resolves.toEqual(ok(result));
        expect(gateway.rejectedCommands).toEqual([normalizedCommand]);
    });

    it('returns domain validation errors without calling either gateway method', async () => {
        const gateway = new FakeWordRequestModerationGateway();
        const service = new ModerateWordRequestsService(gateway);

        await expect(service.approve({ selections: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
        expect(gateway.approvedCommands).toEqual([]);
        expect(gateway.rejectedCommands).toEqual([]);
    });

    it.each([
        ['approve', err<WordRequestModerationResult>({ kind: 'conflict', message: 'already moderated' })],
        ['reject', err<WordRequestModerationResult>({ kind: 'infrastructure', message: 'network unavailable' })],
    ] as const)('preserves %s gateway errors', async (method, gatewayResult) => {
        const gateway = new FakeWordRequestModerationGateway();
        gateway.approveResult = gatewayResult;
        gateway.rejectResult = gatewayResult;
        const service = new ModerateWordRequestsService(gateway);

        const serviceResult = method === 'approve'
            ? await service.approve(command)
            : await service.reject(command);

        expect(serviceResult).toEqual(gatewayResult);
    });
});
