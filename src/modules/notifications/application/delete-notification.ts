import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationImageReferenceQueryGateway } from './notification-image-reference-query-ports';
import type {
    DeletedNotification,
    NotificationDeleteCommandGateway,
} from './notification-delete-command-ports';
import type { NotificationImageStorage } from './notification-write-command-ports';

const deleteInfrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '공지사항 삭제에 실패했습니다.',
});

/** 공지사항 행을 삭제한 뒤 DB가 반환한 관리 이미지의 안전한 정리를 조정합니다. */
export class DeleteNotificationService {
    constructor(
        private readonly gateway: NotificationDeleteCommandGateway,
        private readonly storage: NotificationImageStorage,
        private readonly imageReferences: NotificationImageReferenceQueryGateway,
    ) {}

    async delete(id: number): Promise<Result<void>> {
        if (!Number.isSafeInteger(id) || id <= 0) {
            return err({
                kind: 'validation',
                message: '올바른 공지사항 ID가 필요합니다.',
            });
        }

        const deleteResult = await this.deleteFromDatabase(id);
        if (!deleteResult.ok) return deleteResult;

        await this.bestEffortRemoveDeletedImage(deleteResult.value);
        return ok(undefined);
    }

    private async deleteFromDatabase(id: number): Promise<Result<DeletedNotification>> {
        try {
            return await this.gateway.deleteById(id);
        } catch {
            return err(deleteInfrastructureError());
        }
    }

    private async bestEffortRemoveDeletedImage(deleted: DeletedNotification): Promise<void> {
        if (deleted.imageUrl === null) return;

        try {
            const path = this.storage.managedPathFromPublicUrl(deleted.imageUrl);
            if (path === null) return;

            const referenceResult = await this.imageReferences.hasReference(deleted.imageUrl);
            if (!referenceResult.ok || referenceResult.value) return;

            await this.bestEffortRemove(path);
        } catch {
            return;
        }
    }

    private async bestEffortRemove(path: string): Promise<void> {
        try {
            await this.storage.remove(path);
        } catch {
            return;
        }
    }
}
