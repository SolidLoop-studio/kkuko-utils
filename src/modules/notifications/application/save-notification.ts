import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationImageReferenceQueryGateway } from './notification-image-reference-query-ports';
import type {
    NotificationImageStorage,
    NotificationWriteCommandGateway,
    NotificationWriteResult,
    NotificationWriteValues,
    PersistedNotificationWriteResult,
    StoredNotificationImage,
} from './notification-write-command-ports';
import type { SaveNotificationCommand } from './notification-write-command-types';

const saveInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 저장에 실패했습니다.',
});

const validate = (command: SaveNotificationCommand): ApplicationError | null => {
    if (command.title.trim().length === 0) {
        return {
            kind: 'validation',
            field: 'title',
            message: '공지사항 제목을 입력해주세요.',
        };
    }
    if (command.body.trim().length === 0) {
        return {
            kind: 'validation',
            field: 'body',
            message: '공지사항 내용을 입력해주세요.',
        };
    }
    if (Number.isNaN(Date.parse(command.endsAt))) {
        return {
            kind: 'validation',
            field: 'endsAt',
            message: '올바른 공지사항 종료일이 필요합니다.',
        };
    }
    if (command.mode === 'update' && (!Number.isSafeInteger(command.id) || command.id <= 0)) {
        return {
            kind: 'validation',
            field: 'id',
            message: '올바른 공지사항 ID가 필요합니다.',
        };
    }
    return null;
};

/** 공지사항 저장과 새 이미지 롤백 및 검증된 이전 이미지 정리를 순서대로 조정합니다. */
export class SaveNotificationService {
    constructor(
        private readonly gateway: NotificationWriteCommandGateway,
        private readonly storage: NotificationImageStorage,
        private readonly imageReferences: NotificationImageReferenceQueryGateway,
    ) {}

    async save(command: SaveNotificationCommand): Promise<Result<NotificationWriteResult>> {
        const validationError = validate(command);
        if (validationError !== null) return err(validationError);

        const uploaded = command.imageChange.kind === 'replace'
            ? await this.storage.upload(command.imageChange.file)
            : null;
        if (uploaded !== null && !uploaded.ok) return uploaded;

        const expectedImageUrl = command.mode === 'update' ? command.expectedImageUrl : null;
        const imageUrl = uploaded?.ok
            ? uploaded.value.publicUrl
            : command.imageChange.kind === 'remove' ? null : expectedImageUrl;
        const values: NotificationWriteValues = {
            title: command.title,
            body: command.body,
            imageUrl,
            endsAt: command.endsAt,
            isImportant: command.isImportant,
            isModal: command.isModal,
        };

        const saveResult = await this.saveToDatabase(command, expectedImageUrl, values);
        if (!saveResult.ok) {
            if (uploaded?.ok) await this.bestEffortRemove(uploaded.value.path);
            return saveResult;
        }

        if (command.mode === 'update' && command.imageChange.kind !== 'keep') {
            await this.bestEffortRemovePrevious(uploaded, saveResult.value);
        }

        return ok({
            id: saveResult.value.id,
            imageUrl: saveResult.value.imageUrl,
        });
    }

    private async saveToDatabase(
        command: SaveNotificationCommand,
        expectedImageUrl: string | null,
        values: NotificationWriteValues,
    ): Promise<Result<PersistedNotificationWriteResult>> {
        try {
            return command.mode === 'create'
                ? await this.gateway.create(values)
                : await this.gateway.update(command.id, expectedImageUrl, values);
        } catch {
            return err(saveInfrastructureError());
        }
    }

    private async bestEffortRemovePrevious(
        uploaded: Result<StoredNotificationImage> | null,
        saved: PersistedNotificationWriteResult,
    ): Promise<void> {
        const imageUrlToCleanUp = saved.persistedPreviousImageUrl;
        if (imageUrlToCleanUp === null) return;

        try {
            const previousPath = this.storage.managedPathFromPublicUrl(imageUrlToCleanUp);
            if (previousPath === null || (uploaded?.ok && previousPath === uploaded.value.path)) return;

            const referenceResult = await this.imageReferences.hasReference(imageUrlToCleanUp);
            if (!referenceResult.ok || referenceResult.value) return;
            await this.bestEffortRemove(previousPath);
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
