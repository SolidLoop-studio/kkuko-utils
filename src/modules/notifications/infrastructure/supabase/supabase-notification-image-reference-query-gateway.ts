import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationImageReferenceQueryGateway } from '../../application/notification-image-reference-query-ports';

export interface NotificationImageReferenceQuery {
    eq(column: 'img', value: string): PromiseLike<unknown>;
}

export interface NotificationImageReferenceQueryBuilder {
    select(
        columns: 'id',
        options: { count: 'exact'; head: true },
    ): NotificationImageReferenceQuery;
}

export interface NotificationImageReferenceQueryClient {
    from(table: 'notification'): NotificationImageReferenceQueryBuilder;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const referenceInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 이미지 참조를 확인하지 못했습니다.',
});

const countFromResponse = (value: unknown): number | null => {
    if (!isRecord(value) || value.error !== null || typeof value.count !== 'number') return null;

    return Number.isFinite(value.count)
        && Number.isInteger(value.count)
        && value.count >= 0
        ? value.count
        : null;
};

/** 공지 이미지의 남은 참조를 정확한 개수만으로 확인해 정리 결정을 안전하게 제한합니다. */
export class SupabaseNotificationImageReferenceQueryGateway implements NotificationImageReferenceQueryGateway {
    constructor(private readonly client: NotificationImageReferenceQueryClient) {}

    async hasReference(imageUrl: string): Promise<Result<boolean>> {
        try {
            const response: unknown = await this.client
                .from('notification')
                .select('id', { count: 'exact', head: true })
                .eq('img', imageUrl);
            const count = countFromResponse(response);

            return count === null
                ? err(referenceInfrastructureError())
                : ok(count >= 1);
        } catch {
            return err(referenceInfrastructureError());
        }
    }
}
