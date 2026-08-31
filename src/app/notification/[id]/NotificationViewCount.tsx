'use client';

import { Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRecordNotificationView } from '@/src/modules/notifications/presentation/use-record-notification-view';

interface NotificationViewCountProps {
    id: number;
    initialViews: number;
}

/** 상세 페이지가 열린 뒤 서버의 최신 조회 수를 조용히 반영합니다. */
export default function NotificationViewCount({ id, initialViews }: NotificationViewCountProps) {
    const { record } = useRecordNotificationView();
    const [views, setViews] = useState(initialViews);
    const recordedIdRef = useRef<number | null>(null);
    const isMountedRef = useRef(false);

    useEffect(() => {
        setViews(initialViews);
    }, [id, initialViews]);

    useEffect(() => {
        isMountedRef.current = true;
        if (recordedIdRef.current !== id) {
            recordedIdRef.current = id;
            void record(id).then((result) => {
                if (isMountedRef.current && recordedIdRef.current === id && result.ok) {
                    setViews(result.value);
                }
            });
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [id, record]);

    return (
        <span className="inline-flex items-center gap-1">
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">조회수</span>
            <span>{views.toLocaleString('ko-KR')}</span>
        </span>
    );
}
