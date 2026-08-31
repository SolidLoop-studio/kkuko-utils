import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationDetailQueryGateway } from '../../application/notification-detail-query-ports';
import type { NotificationDetailProjection } from '../../application/notification-detail-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface NotificationDetailQueryBuilder {
    select(columns: string): NotificationDetailQueryBuilder;
    eq(column: 'id', value: number): NotificationDetailQueryBuilder;
    maybeSingle(): PromiseLike<QueryResponse>;
}

export interface NotificationDetailQueryClient {
    from(table: 'notification'): NotificationDetailQueryBuilder;
}

const notFoundError = (): ApplicationError => ({
    kind: 'not-found',
    message: '공지사항을 찾을 수 없습니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isPositiveSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeSafeInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isValidDateString = (value: unknown): value is string => (
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

const parseProjection = (value: unknown): NotificationDetailProjection | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || typeof value.title !== 'string'
        || typeof value.body !== 'string'
        || (typeof value.img !== 'string' && value.img !== null)
        || !isValidDateString(value.created_at)
        || !isValidDateString(value.end_at)
        || typeof value.is_important !== 'boolean'
        || typeof value.is_modal !== 'boolean'
        || !isNonNegativeSafeInteger(value.views)) {
        return null;
    }

    return {
        id: value.id,
        title: value.title,
        body: value.body,
        imageUrl: value.img,
        createdAt: value.created_at,
        endsAt: value.end_at,
        isImportant: value.is_important,
        isModal: value.is_modal,
        views: value.views,
    };
};

/** 서버 Supabase client로 공지 상세 projection 한 건을 조회합니다. */
export class SupabaseNotificationDetailQueryGateway implements NotificationDetailQueryGateway {
    constructor(private readonly client: NotificationDetailQueryClient) {}

    async findById(id: number): Promise<Result<NotificationDetailProjection>> {
        try {
            const response = await this.client
                .from('notification')
                .select('id, title, body, img, created_at, end_at, is_important, is_modal, views')
                .eq('id', id)
                .maybeSingle();

            if (!isRecord(response) || response.error !== null) {
                return err(infrastructureError());
            }
            if (response.data === null) return err(notFoundError());

            const projection = parseProjection(response.data);
            return projection === null ? err(infrastructureError()) : ok(projection);
        } catch {
            return err(infrastructureError());
        }
    }
}
