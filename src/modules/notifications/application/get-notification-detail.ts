import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { NotificationDetailQueryGateway } from './notification-detail-query-ports';
import type { NotificationDetailProjection } from './notification-detail-query-types';

const validationError = (): ApplicationError => ({
    kind: 'validation',
    message: '유효한 공지사항 ID가 필요합니다.',
    field: 'id',
});

const notFoundError = (): ApplicationError => ({
    kind: 'not-found',
    message: '공지사항을 찾을 수 없습니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항을 불러오는 중 오류가 발생했습니다.',
});

/** 공지 identity를 검증하고 상세 projection 조회 오류를 안정적인 결과로 정규화합니다. */
export class GetNotificationDetailService {
    constructor(private readonly gateway: NotificationDetailQueryGateway) {}

    async get(id: number): Promise<Result<NotificationDetailProjection>> {
        if (!Number.isSafeInteger(id) || id <= 0) return err(validationError());

        try {
            const result = await this.gateway.findById(id);
            if (result.ok) return result;
            return result.error.kind === 'not-found'
                ? err(notFoundError())
                : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}
