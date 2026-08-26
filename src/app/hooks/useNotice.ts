"use client";

import { useModalNotice } from '@/src/modules/notifications';

interface NoticeData {
    id: number;
    title: string;
    body: string;
    img: string | null;
    created_at: string;
    end_at: string;
}

export function useNotice() {
    const { notice: modalNotice, isLoading, error, dismiss } = useModalNotice();
    const notice: NoticeData | null = modalNotice === null
        ? null
        : {
            id: modalNotice.id,
            title: modalNotice.title,
            body: modalNotice.body,
            img: modalNotice.imageUrl,
            created_at: modalNotice.createdAt,
            end_at: modalNotice.endsAt,
        };

    return {
        notice,
        showNoticeModal: notice !== null,
        closeNoticeModal: dismiss,
        loading: isLoading,
        error,
    };
}
