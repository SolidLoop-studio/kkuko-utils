import { err, type Result } from '@/src/shared/application/result';
import type {
    AdminLogCommandGateway,
    DeleteAdminLogsCommand,
} from './admin-log-command-ports';

const deleteError = () => ({
    kind: 'infrastructure' as const,
    message: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
});

/** 선택한 관리자 로그 ID를 검증한 뒤 종류별 삭제 명령을 실행합니다. */
export class DeleteAdminLogsService {
    constructor(private readonly gateway: AdminLogCommandGateway) {}

    async execute(
        command: DeleteAdminLogsCommand,
    ): Promise<Result<{ deletedIds: number[] }>> {
        if (command.ids.length === 0) {
            return err({
                kind: 'validation',
                message: '삭제할 로그 ID가 필요합니다.',
            });
        }

        if (command.ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
            return err({
                kind: 'validation',
                message: '올바른 로그 ID가 필요합니다.',
            });
        }

        if (new Set(command.ids).size !== command.ids.length) {
            return err({
                kind: 'validation',
                message: '중복된 로그 ID가 있습니다.',
            });
        }

        try {
            const result = await this.gateway.deleteLogs({
                kind: command.kind,
                ids: [...command.ids],
            });
            return result.ok ? result : err(deleteError());
        } catch {
            return err(deleteError());
        }
    }
}
