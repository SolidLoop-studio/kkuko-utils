import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { ModalNoticeQueryGateway } from '../../application/modal-notice-query-ports';
import type { ModalNotice } from '../../application/notification-list-query-types';

type QueryResponse = {
    data: unknown;
    error: unknown;
};

interface ModalNoticeQueryBuilder extends PromiseLike<QueryResponse> {
    select(columns: string): ModalNoticeQueryBuilder;
    gte(column: 'end_at', value: string): ModalNoticeQueryBuilder;
    eq(column: 'is_modal', value: boolean): ModalNoticeQueryBuilder;
    order(
        column: 'created_at' | 'id',
        options: { ascending: boolean },
    ): ModalNoticeQueryBuilder;
}

export interface SupabaseModalNoticeQueryClient {
    from(table: 'notification'): ModalNoticeQueryBuilder;
}

const KOREA_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항을 불러오는 중 오류가 발생했습니다.',
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseModalNotice = (value: unknown): ModalNotice | null => {
    if (!isRecord(value)
        || typeof value.id !== 'number'
        || !Number.isSafeInteger(value.id)
        || value.id <= 0
        || typeof value.title !== 'string'
        || typeof value.body !== 'string'
        || (typeof value.img !== 'string' && value.img !== null)
        || typeof value.created_at !== 'string'
        || Number.isNaN(Date.parse(value.created_at))
        || typeof value.end_at !== 'string'
        || Number.isNaN(Date.parse(value.end_at))) {
        return null;
    }

    return {
        id: value.id,
        title: value.title,
        body: value.body,
        imageUrl: value.img,
        createdAt: value.created_at,
        endsAt: value.end_at,
    };
};

/** 실행 환경의 timezone과 무관하게 현재 한국 날짜의 마지막 시각을 반환합니다. */
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

/** 한국 날짜 기준으로 종료되지 않은 최신 모달 공지를 조회합니다. */
export class SupabaseModalNoticeQueryGateway implements ModalNoticeQueryGateway {
    constructor(
        private readonly client: SupabaseModalNoticeQueryClient,
        private readonly clock: () => Date = () => new Date(),
    ) {}

    async loadActive(): Promise<Result<ModalNotice | null>> {
        try {
            const response = await this.client
                .from('notification')
                .select('id, title, body, img, created_at, end_at')
                .gte('end_at', getKoreaDayEndIso(this.clock()))
                .eq('is_modal', true)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (!isRecord(response) || response.error !== null || !Array.isArray(response.data)) {
                return err(infrastructureError());
            }

            if (response.data.length === 0) return ok(null);
            const modalNotice = parseModalNotice(response.data[0]);
            return modalNotice === null ? err(infrastructureError()) : ok(modalNotice);
        } catch {
            return err(infrastructureError());
        }
    }
}
