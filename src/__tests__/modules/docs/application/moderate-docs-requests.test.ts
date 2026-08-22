import { err, ok, type Result } from '@/src/shared/application/result';
import { ModerateDocsRequestsService } from '@/src/modules/docs/application/moderate-docs-requests';
import type {
    ApproveDocsRequestsCommand,
    DocsRequestModerationResult,
    RejectDocsRequestsCommand,
} from '@/src/modules/docs/application/docs-request-moderation-types';
import type { DocsRequestModerationGateway } from '@/src/modules/docs/application/docs-request-moderation-ports';

const result: DocsRequestModerationResult = {
    processedRequestIds: [11, 22],
    processedRequestCount: 2,
};

class FakeDocsRequestModerationGateway implements DocsRequestModerationGateway {
    approveResult: Result<DocsRequestModerationResult> = ok(result);
    rejectResult: Result<DocsRequestModerationResult> = ok(result);
    readonly approvedCommands: ApproveDocsRequestsCommand[] = [];
    readonly rejectedCommands: RejectDocsRequestsCommand[] = [];

    async approve(command: ApproveDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        this.approvedCommands.push(command);
        return this.approveResult;
    }

    async reject(command: RejectDocsRequestsCommand): Promise<Result<DocsRequestModerationResult>> {
        this.rejectedCommands.push(command);
        return this.rejectResult;
    }
}

describe('ModerateDocsRequestsService', () => {
    it('passes a normalized approval command to the gateway', async () => {
        const gateway = new FakeDocsRequestModerationGateway();
        const service = new ModerateDocsRequestsService(gateway);

        await expect(service.approve({
            selections: [{ requestId: 22, duem: false }, { requestId: 11, duem: true }],
        })).resolves.toEqual(ok(result));
        expect(gateway.approvedCommands).toEqual([{
            selections: [{ requestId: 11, duem: true }, { requestId: 22, duem: false }],
        }]);
    });

    it('passes a normalized rejection command to the gateway', async () => {
        const gateway = new FakeDocsRequestModerationGateway();
        const service = new ModerateDocsRequestsService(gateway);

        await expect(service.reject({ requestIds: [22, 11] })).resolves.toEqual(ok(result));
        expect(gateway.rejectedCommands).toEqual([{ requestIds: [11, 22] }]);
    });

    it('returns validation failure without calling the gateway', async () => {
        const gateway = new FakeDocsRequestModerationGateway();
        const service = new ModerateDocsRequestsService(gateway);

        await expect(service.approve({ selections: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation' },
        });
        expect(gateway.approvedCommands).toEqual([]);
        expect(gateway.rejectedCommands).toEqual([]);
    });

    it.each([
        ['approve', err<DocsRequestModerationResult>({ kind: 'conflict', message: 'already moderated' })],
        ['reject', err<DocsRequestModerationResult>({ kind: 'conflict', message: 'already moderated' })],
    ] as const)('returns the %s gateway conflict unchanged', async (method, gatewayResult) => {
        const gateway = new FakeDocsRequestModerationGateway();
        gateway.approveResult = gatewayResult;
        gateway.rejectResult = gatewayResult;
        const service = new ModerateDocsRequestsService(gateway);

        const serviceResult = method === 'approve'
            ? await service.approve({ selections: [{ requestId: 11, duem: true }] })
            : await service.reject({ requestIds: [11] });

        expect(serviceResult).toEqual(gatewayResult);
    });
});
