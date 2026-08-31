import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { NotificationViewCommandGateway } from './notification-view-command-ports';

const validationError = (): ApplicationError => ({
    kind: 'validation',
    message: '올바른 공지사항 ID가 필요합니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 조회 수 기록에 실패했습니다.',
});

/** 공지 identity를 검증하고 조회 수 기록 오류를 안정적인 결과로 정규화합니다. */
export class RecordNotificationViewService {
    constructor(private readonly gateway: NotificationViewCommandGateway) {}

    async record(id: number): Promise<Result<number>> {
        if (!Number.isSafeInteger(id) || id <= 0) return err(validationError());

        try {
            return await this.gateway.record(id);
        } catch {
            return err(infrastructureError());
        }
    }
}
