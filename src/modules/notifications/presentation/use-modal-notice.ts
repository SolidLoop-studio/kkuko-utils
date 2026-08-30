'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { GetModalNoticeService } from '../application/get-modal-notice';
import type { ModalNotice } from '../application/notification-list-query-types';
import { createBrowserNotificationServices } from '../infrastructure/browser/browser-notification-services';
import {
    NOTIFICATION_STALE_TIME_MS,
    notificationQueryKeys,
} from './notification-query-keys';
import { readHiddenNoticeIds } from './notice-dismissal-storage';

export { NOTIFICATION_STALE_TIME_MS, notificationQueryKeys } from './notification-query-keys';

type ModalNoticeQueryService = Pick<GetModalNoticeService, 'get'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항을 불러오는 중 오류가 발생했습니다.',
});

const isApplicationError = (value: unknown): value is ApplicationError => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { kind?: unknown; message?: unknown };
    return (candidate.kind === 'validation'
        || candidate.kind === 'unauthorized'
        || candidate.kind === 'forbidden'
        || candidate.kind === 'not-found'
        || candidate.kind === 'conflict'
        || candidate.kind === 'infrastructure')
        && typeof candidate.message === 'string';
};

const unwrapQuery = async (
    operation: () => Promise<Result<ModalNotice | null>>,
): Promise<ModalNotice | null> => {
    try {
        const result = await operation();
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        throw isApplicationError(error) ? error : infrastructureError();
    }
};

/**
 * 활성 모달 공지를 1분간 cache합니다.
 * persistent `hiddenNotices`와 현재 mount에서 닫은 ID는 background refetch 뒤에도 다시 열지 않습니다.
 */
export const useModalNotice = () => {
    const [service] = useState<ModalNoticeQueryService>(() => (
        createBrowserNotificationServices().modalNoticeQueryService
    ));
    const [dismissedNoticeId, setDismissedNoticeId] = useState<number | null>(null);
    const query = useQuery<ModalNotice | null, ApplicationError>({
        queryKey: notificationQueryKeys.activeList,
        queryFn: () => unwrapQuery(() => service.get()),
        staleTime: NOTIFICATION_STALE_TIME_MS,
        retry: false,
    });

    const candidate = query.data ?? null;
    const isHidden = candidate !== null && readHiddenNoticeIds().includes(candidate.id);
    const notice = candidate !== null
        && candidate.id !== dismissedNoticeId
        && !isHidden
        ? candidate
        : null;
    const dismiss = useCallback(() => {
        if (candidate !== null) setDismissedNoticeId(candidate.id);
    }, [candidate]);

    return {
        notice,
        isLoading: query.isPending,
        error: query.error,
        dismiss,
    };
};
