import { err, type Result } from '@/src/shared/application/result';
import type { NotificationDeleteCommandGateway } from './notification-delete-command-ports';

/** 공지사항 삭제 ID를 검증하고 notification command port를 호출합니다. */
export class DeleteNotificationService {
    constructor(private readonly gateway: NotificationDeleteCommandGateway) {}

    async delete(id: number): Promise<Result<void>> {
        if (!Number.isSafeInteger(id) || id <= 0) {
            return err({
                kind: 'validation',
                message: '올바른 공지사항 ID가 필요합니다.',
            });
        }

        try {
            return await this.gateway.deleteById(id);
        } catch {
            return err({
                kind: 'infrastructure',
                message: '공지사항 삭제에 실패했습니다.',
            });
        }
    }
}
