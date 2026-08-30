import { DeleteAdminLogsService } from '@/src/modules/admin-logs/application/delete-admin-logs';
import type {
    AdminLogCommandGateway,
    DeleteAdminLogsCommand,
} from '@/src/modules/admin-logs/application/admin-log-command-ports';
import { err, ok, type Result } from '@/src/shared/application/result';

const deleteError = {
    kind: 'infrastructure' as const,
    message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
};

class FakeAdminLogCommandGateway implements AdminLogCommandGateway {
    readonly commands: DeleteAdminLogsCommand[] = [];

    constructor(
        private readonly behavior: (
            command: DeleteAdminLogsCommand,
        ) => Promise<Result<{ deletedIds: number[] }>> = async (command) => ok({
            deletedIds: [...command.ids],
        }),
    ) {}

    async deleteLogs(
        command: DeleteAdminLogsCommand,
    ): Promise<Result<{ deletedIds: number[] }>> {
        this.commands.push(command);
        return this.behavior(command);
    }
}

describe('DeleteAdminLogsService', () => {
    it('rejects an empty ID list before the command gateway', async () => {
        // Break caught: issuing an unbounded or meaningless delete with no selected rows.
        const gateway = new FakeAdminLogCommandGateway();
        const service = new DeleteAdminLogsService(gateway);

        await expect(service.execute({ kind: 'word', ids: [] })).resolves.toEqual(err({
            kind: 'validation',
            message: '삭제할 로그 ID가 필요합니다.',
        }));
        expect(gateway.commands).toEqual([]);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        'rejects invalid ID %p before the command gateway',
        async (id) => {
            // Break caught: allowing a non-positive or unsafe row ID across the command boundary.
            const gateway = new FakeAdminLogCommandGateway();
            const service = new DeleteAdminLogsService(gateway);

            await expect(service.execute({ kind: 'docs', ids: [7, id] })).resolves.toEqual(err({
                kind: 'validation',
                message: '올바른 로그 ID가 필요합니다.',
            }));
            expect(gateway.commands).toEqual([]);
        },
    );

    it('rejects duplicate IDs before the command gateway', async () => {
        // Break caught: collapsing duplicate caller input and hiding an invalid selection command.
        const gateway = new FakeAdminLogCommandGateway();
        const service = new DeleteAdminLogsService(gateway);

        await expect(service.execute({ kind: 'word', ids: [9, 4, 9] })).resolves.toEqual(err({
            kind: 'validation',
            message: '중복된 로그 ID가 있습니다.',
        }));
        expect(gateway.commands).toEqual([]);
    });

    it.each(['word', 'docs'] as const)(
        'preserves caller order for valid unique %s log IDs',
        async (kind) => {
            // Break caught: sorting or otherwise reordering the selected rows before deletion.
            const gateway = new FakeAdminLogCommandGateway();
            const service = new DeleteAdminLogsService(gateway);
            const command: DeleteAdminLogsCommand = { kind, ids: [23, 5, 17] };

            await expect(service.execute(command)).resolves.toEqual(ok({
                deletedIds: [23, 5, 17],
            }));
            expect(gateway.commands).toEqual([{ kind, ids: [23, 5, 17] }]);
        },
    );

    it('normalizes a returned gateway failure to the stable delete error', async () => {
        // Break caught: exposing adapter-specific or private database diagnostics.
        const gateway = new FakeAdminLogCommandGateway(async () => err({
            kind: 'forbidden',
            message: 'private RLS policy detail',
        }));
        const service = new DeleteAdminLogsService(gateway);

        const result = await service.execute({ kind: 'word', ids: [3] });

        expect(result).toEqual(err(deleteError));
        expect(JSON.stringify(result)).not.toContain('private');
    });

    it('normalizes a thrown gateway failure to the stable delete error', async () => {
        // Break caught: allowing a rejected adapter promise or transport detail to escape Application.
        const gateway = new FakeAdminLogCommandGateway(async () => {
            throw new Error('private transport detail');
        });
        const service = new DeleteAdminLogsService(gateway);

        const result = await service.execute({ kind: 'docs', ids: [8] });

        expect(result).toEqual(err(deleteError));
        expect(JSON.stringify(result)).not.toContain('private');
    });
});
