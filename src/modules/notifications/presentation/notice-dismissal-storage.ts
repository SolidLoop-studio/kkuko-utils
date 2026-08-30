const HIDDEN_NOTICES_STORAGE_KEY = 'hiddenNotices';

interface NoticeDismissalStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const normalizeNoticeIds = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number => (
        typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    )))];
};

/** 손상되거나 접근할 수 없는 dismissal storage를 빈 목록으로 안전하게 복구합니다. */
export const readHiddenNoticeIds = (
    storage: NoticeDismissalStorage = localStorage,
): number[] => {
    try {
        const storedValue: unknown = JSON.parse(
            storage.getItem(HIDDEN_NOTICES_STORAGE_KEY) || '[]',
        );
        return normalizeNoticeIds(storedValue);
    } catch {
        return [];
    }
};

/** 숨김 공지 ID를 정규화해 저장하며 storage 실패는 modal 닫힘을 방해하지 않습니다. */
export const persistHiddenNoticeId = (
    noticeId: number,
    storage: NoticeDismissalStorage = localStorage,
): void => {
    if (!Number.isSafeInteger(noticeId) || noticeId <= 0) return;

    try {
        const noticeIds = readHiddenNoticeIds(storage);
        if (!noticeIds.includes(noticeId)) noticeIds.push(noticeId);
        storage.setItem(HIDDEN_NOTICES_STORAGE_KEY, JSON.stringify(noticeIds));
    } catch {
        // localStorage 접근 실패는 현재 modal 닫힘을 막지 않습니다.
    }
};
