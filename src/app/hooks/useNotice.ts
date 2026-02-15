"use client";

import { useState, useEffect } from 'react';
import { SCM } from '@/src/app/lib/supabaseClient';

interface NoticeData {
    id: number;
    title: string;
    body: string;
    img: string | null;
    created_at: string;
    end_at: string;
}

export function useNotice() {
    const [notice, setNotice] = useState<NoticeData | null>(null);
    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotice = async () => {
            try {
                const { data, error } = await SCM.get().notice();
                
                if (error) {
                    console.error('공지사항 가져오기 오류:', error);
                    return;
                }

                if (data) {
                    // 로컬 스토리지에서 숨겨진 공지 ID 목록 가져오기
                    const hiddenNotices = JSON.parse(localStorage.getItem('hiddenNotices') || '[]');
                    
                    // 현재 공지가 숨겨진 목록에 없으면 표시
                    if (!hiddenNotices.includes(data.id)) {
                        setNotice(data);
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
