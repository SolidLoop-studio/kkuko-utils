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

    useEffect(() => {
        setViews(initialViews);
    }, [id, initialViews]);

    useEffect(() => {
        if (recordedIdRef.current === id) return;
        recordedIdRef.current = id;
        let isCurrent = true;

        void record(id).then((result) => {
            if (isCurrent && result.ok) setViews(result.value);
        });

        return () => {
            isCurrent = false;
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
