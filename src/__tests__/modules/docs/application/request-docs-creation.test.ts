import type { DocsCreationRequestGateway } from '@/src/modules/docs/application/docs-creation-request-ports';
import type { DocsCreationRequestCommand } from '@/src/modules/docs/application/docs-creation-request-types';
import { RequestDocsCreationService } from '@/src/modules/docs/application/request-docs-creation';
import { ok, type Result } from '@/src/shared/application/result';

class FakeDocsCreationRequestGateway implements DocsCreationRequestGateway {
    readonly commands: DocsCreationRequestCommand[] = [];

    result: Result<void> = ok(undefined);

    async request(command: DocsCreationRequestCommand): Promise<Result<void>> {
        this.commands.push(command);
        return this.result;
    }
}

const validationError = {
    kind: 'validation' as const,
    message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

describe('RequestDocsCreationService', () => {
    it.each([
        ['non-Hangul docs name', { docsName: 'A', requesterId: 'user-7' }],
        ['precomposed Hangul docs name', { docsName: '가', requesterId: 'user-7' }],
        ['whitespace docs name', { docsName: ' ', requesterId: 'user-7' }],
        ['normalization-sensitive docs name', { docsName: 'Å', requesterId: 'user-7' }],
        ['whitespace requester ID', { docsName: '가', requesterId: ' ' }],
    ])('passes a valid command with %s unchanged', async (_description, command) => {
        const gateway = new FakeDocsCreationRequestGateway();
        const service = new RequestDocsCreationService(gateway);

        await expect(service.request(command)).resolves.toEqual(ok(undefined));
        expect(gateway.commands).toEqual([command]);
    });

    it.each([
        { docsName: '', requesterId: 'user-7' },
        { docsName: '가나', requesterId: 'user-7' },
        { docsName: '😀', requesterId: 'user-7' },
        { docsName: '가', requesterId: '' },
    ])('rejects invalid command %p before infrastructure', async (command) => {
        const gateway = new FakeDocsCreationRequestGateway();
        const service = new RequestDocsCreationService(gateway);

        await expect(service.request(command)).resolves.toEqual({
            ok: false,
            error: validationError,
        });
        expect(gateway.commands).toEqual([]);
    });
});
