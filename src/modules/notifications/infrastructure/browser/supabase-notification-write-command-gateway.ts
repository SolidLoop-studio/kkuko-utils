import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { browserSupabaseClient } from '@/src/shared/infrastructure/supabase/browser-client';
import type {
    NotificationWriteCommandGateway,
    NotificationWriteValues,
    PersistedNotificationWriteResult,
} from '../../application/notification-write-command-ports';

export interface NotificationWritePayload {
    title: string;
    body: string;
    img: string | null;
    end_at: string;
    is_important: boolean;
    is_modal: boolean;
}

export interface NotificationWriteQuery {
    insert(payload: NotificationWritePayload): NotificationWriteQuery;
    update(payload: NotificationWritePayload): NotificationWriteQuery;
    eq(column: 'id', value: number): NotificationWriteQuery;
    eq(column: 'img', value: string): NotificationWriteQuery;
    is(column: 'img', value: null): NotificationWriteQuery;
    select(columns: 'id, img'): NotificationWriteQuery;
    single(): PromiseLike<unknown>;
    maybeSingle(): PromiseLike<unknown>;
}

export interface NotificationWriteClient {
    from(table: 'notification'): NotificationWriteQuery;
}

interface NotificationWriteRow {
    id: number;
    img: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isNotificationWriteRow = (value: unknown): value is NotificationWriteRow =>
    isRecord(value)
    && typeof value.id === 'number'
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && (typeof value.img === 'string' || value.img === null);

const saveInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 저장에 실패했습니다.',
});

const modalOverlapError = (): ApplicationError => ({
    kind: 'conflict',
    code: 'NOTIFICATION_MODAL_OVERLAP',
    message: '모달 공지가 겹쳤습니다 (동일 기간에 모달 공지는 하나만 가능합니다)',
});

const staleImageError = (): ApplicationError => ({
    kind: 'conflict',
    code: 'NOTIFICATION_STALE_IMAGE',
    message: '공지사항이 다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.',
});

const mapReturnedError = (error: unknown): ApplicationError =>
    isRecord(error) && error.code === '23P01'
        ? modalOverlapError()
        : saveInfrastructureError();

const toPayload = (values: NotificationWriteValues): NotificationWritePayload => ({
    title: values.title,
    body: values.body,
    img: values.imageUrl,
    end_at: values.endsAt,
    is_important: values.isImportant,
    is_modal: values.isModal,
});

/** 브라우저 Supabase client로 공지 행을 생성하고 낙관적 이미지 조건으로 수정합니다. */
export class SupabaseNotificationWriteCommandGateway implements NotificationWriteCommandGateway {
    constructor(
        private readonly client: NotificationWriteClient = browserSupabaseClient as unknown as NotificationWriteClient,
    ) {}

    async create(values: NotificationWriteValues): Promise<Result<PersistedNotificationWriteResult>> {
        try {
            const response: unknown = await this.client
                .from('notification')
                .insert(toPayload(values))
                .select('id, img')
                .single();

            if (!isRecord(response) || response.error !== null) {
                return err(mapReturnedError(isRecord(response) ? response.error : null));
            }
            if (!isNotificationWriteRow(response.data)) return err(saveInfrastructureError());

            return ok({
                id: response.data.id,
                imageUrl: response.data.img,
                persistedPreviousImageUrl: null,
            });
        } catch {
            return err(saveInfrastructureError());
        }
    }

    async update(
        id: number,
        expectedImageUrl: string | null,
        values: NotificationWriteValues,
    ): Promise<Result<PersistedNotificationWriteResult>> {
        try {
            const byId = this.client
                .from('notification')
                .update(toPayload(values))
                .eq('id', id);
            const byExpectedImage = expectedImageUrl === null
                ? byId.is('img', null)
                : byId.eq('img', expectedImageUrl);
            const response: unknown = await byExpectedImage
                .select('id, img')
                .maybeSingle();

            if (!isRecord(response) || response.error !== null) {
                return err(mapReturnedError(isRecord(response) ? response.error : null));
            }
            if (response.data === null) return err(staleImageError());
            if (!isNotificationWriteRow(response.data)) return err(saveInfrastructureError());

            return ok({
                id: response.data.id,
                imageUrl: response.data.img,
                persistedPreviousImageUrl: expectedImageUrl,
            });
        } catch {
            return err(saveInfrastructureError());
        }
    }
}
