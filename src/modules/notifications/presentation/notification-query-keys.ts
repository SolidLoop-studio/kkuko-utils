/** 공지 projection은 목록과 최신 모달이 같은 cache entry를 공유합니다. */
export const notificationQueryKeys = {
    all: ['notifications'] as const,
    activeList: ['notifications', 'active-list'] as const,
};

/** 전역 QueryClient와 같은 1분 fresh 정책을 명시적으로 고정합니다. */
export const NOTIFICATION_STALE_TIME_MS = 60 * 1000;
