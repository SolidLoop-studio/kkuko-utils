'use client';

import { recordNotificationViewAction } from '@/src/app/notification/actions';
import { err, type Result } from '@/src/shared/application/result';

const recordViewInfrastructureError = () => err<number>({
    kind: 'infrastructure',
    message: '공지사항 조회 수 기록에 실패했습니다.',
});

/** 공지사항 상세 조회 수 기록 Server Action을 안정적인 Result 계약으로 제공합니다. */
export const useRecordNotificationView = (): {
    record(id: number): Promise<Result<number>>;
} => ({
    record: async (id) => {
        try {
            return await recordNotificationViewAction(id);
        } catch {
            return recordViewInfrastructureError();
        }
    },
});
