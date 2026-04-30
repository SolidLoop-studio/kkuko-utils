"use client";

import { useState, useEffect } from 'react';
import { notificationContainer } from '@/src/app/lib/supabaseClient';
import type { NotificationEntity } from '@/src/lib/services/domain/notification/NotificationEntity';

export function useNotice() {
    const [notice, setNotice] = useState<NotificationEntity | null>(null);
    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotice = async () => {
            try {
                const result = await notificationContainer.notificationService.getActiveModal();

                if (!result.success) {
                    console.error('공지사항 가져오기 오류:', result.error);
                    return;
                }

                if (result.data) {
                    // 로컬 스토리지에서 숨겨진 공지 ID 목록 가져오기
                    const hiddenNotices = JSON.parse(localStorage.getItem('hiddenNotices') || '[]');

                    // 현재 공지가 숨겨진 목록에 없으면 표시
                    if (!hiddenNotices.includes(result.data.id)) {
                        setNotice(result.data);
                        setShowNoticeModal(true);
                    }
                }
            } catch (error) {
                console.error('공지사항 처리 중 오류:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotice();
    }, []);

    const closeNoticeModal = () => {
        setShowNoticeModal(false);
        setNotice(null);
    };

    return {
        notice,
        showNoticeModal,
        closeNoticeModal,
        loading
    };
}
