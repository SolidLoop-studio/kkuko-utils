import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationViewCommandGateway } from '../../application/notification-view-command-ports';

export interface NotificationViewCommandClient {
    rpc(
        functionName: 'increment_notification_views',
        parameters: { p_notification_id: number },
    ): PromiseLike<unknown>;
}

const notFoundError = (): ApplicationError => ({
    kind: 'not-found',
    message: '공지사항을 찾을 수 없습니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 조회 수 기록에 실패했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeSafeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** 공개 RPC 호출을 공지 조회 수 command port로 안전하게 변환합니다. */
export class SupabaseNotificationViewCommandGateway implements NotificationViewCommandGateway {
    constructor(private readonly client: NotificationViewCommandClient) {}

    async record(id: number): Promise<Result<number>> {
        try {
            const response: unknown = await this.client.rpc('increment_notification_views', {
                p_notification_id: id,
            });

            if (!isRecord(response) || response.error !== null) return err(infrastructureError());
            if (response.data === null) return err(notFoundError());
            return isNonNegativeSafeInteger(response.data)
                ? ok(response.data)
                : err(infrastructureError());
        } catch {
            return err(infrastructureError());
        }
    }
}
