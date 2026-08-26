import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationListQueryGateway } from '../../application/notification-list-query-ports';
import type {
    ModalNotice,
    NotificationListItem,
    NotificationListProjection,
} from '../../application/notification-list-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface NotificationListQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): NotificationListQueryBuilder;
    gte(column: 'end_at', value: string): NotificationListQueryBuilder;
    order(
        column: 'is_important' | 'created_at' | 'id',
        options: { ascending: boolean },
    ): NotificationListQueryBuilder;
}

export interface SupabaseNotificationListQueryClient {
    from(table: 'notification'): NotificationListQueryBuilder;
}

type NotificationRow = {
    id: number;
    title: string;
    body: string;
    imageUrl: string | null;
    createdAt: string;
    endsAt: string;
    isImportant: boolean;
    isModal: boolean;
};

const KOREA_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

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

const isValidDateString = (value: unknown): value is string => (
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

const parseRow = (value: unknown): NotificationRow | null => {
    if (!isRecord(value)
        || !isPositiveSafeInteger(value.id)
        || typeof value.title !== 'string'
        || typeof value.body !== 'string'
        || (typeof value.img !== 'string' && value.img !== null)
        || !isValidDateString(value.created_at)
        || !isValidDateString(value.end_at)
        || typeof value.is_important !== 'boolean'
        || typeof value.is_modal !== 'boolean') {
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
    };
};

const compareCreatedAtDescending = (left: NotificationRow, right: NotificationRow) => (
    Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id
);

const compareListOrder = (left: NotificationRow, right: NotificationRow) => (
    Number(right.isImportant) - Number(left.isImportant)
    || compareCreatedAtDescending(left, right)
);

/**
 * 실행 환경의 timezone과 무관하게 현재 한국 날짜의 마지막 시각을 UTC ISO 문자열로 반환합니다.
 * date-only 종료일을 사용하는 기존 정책에 맞춰 그 시각 이후까지 `end_at`이 남은 공지만 활성으로 취급합니다.
 */
export const getKoreaDayEndIso = (now: Date): string => {
    const koreaClock = new Date(now.getTime() + KOREA_OFFSET_MILLISECONDS);
    const koreaDayEndUtc = Date.UTC(
        koreaClock.getUTCFullYear(),
        koreaClock.getUTCMonth(),
        koreaClock.getUTCDate(),
        23,
        59,
        59,
        999,
    ) - KOREA_OFFSET_MILLISECONDS;
    return new Date(koreaDayEndUtc).toISOString();
};

/** Supabase 공지 행을 활성 목록과 최신 모달 projection으로 변환합니다. */
export class SupabaseNotificationListQueryGateway implements NotificationListQueryGateway {
    constructor(
        private readonly client: SupabaseNotificationListQueryClient,
        private readonly clock: () => Date = () => new Date(),
    ) {}

    async loadActive(): Promise<Result<NotificationListProjection>> {
        try {
            const response = await this.client
                .from('notification')
                .select('id, title, body, img, created_at, end_at, is_important, is_modal')
                .gte('end_at', getKoreaDayEndIso(this.clock()))
                .order('is_important', { ascending: false })
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            const rows: NotificationRow[] = [];
            for (const value of response.data) {
                const row = parseRow(value);
                if (row === null) return err(infrastructureError());
                rows.push(row);
            }

            const notifications: NotificationListItem[] = [...rows]
                .sort(compareListOrder)
                .map((row) => ({
                    id: row.id,
                    title: row.title,
                    createdAt: row.createdAt,
                    isImportant: row.isImportant,
                }));
            const modalRow = rows
                .filter((row) => row.isModal)
                .sort(compareCreatedAtDescending)[0];
            const modalNotice: ModalNotice | null = modalRow === undefined
                ? null
                : {
                    id: modalRow.id,
                    title: modalRow.title,
                    body: modalRow.body,
                    imageUrl: modalRow.imageUrl,
                    createdAt: modalRow.createdAt,
                    endsAt: modalRow.endsAt,
                };

            return ok({ notifications, modalNotice });
        } catch {
            return err(infrastructureError());
        }
    }
}
