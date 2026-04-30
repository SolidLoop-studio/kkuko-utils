"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/button";
import NotificationWriteForm from "../components/NotificationWriteForm";
import ErrorModal from "@/src/app/components/ErrModal";
import type { ErrorMessage } from "@/src/app/types/type";
import type { NotificationEntity } from '@/src/lib/services/domain/notification/NotificationEntity';

interface NotificationWriteProps {
    notification?: NotificationEntity;
}

export default function NotificationWrite({ notification }: NotificationWriteProps) {
    const user = useSelector((state: RootState) => state.user);
    const [error, setError] = useState<ErrorMessage | null>(null);

    // 관리자 권한 체크
    if (user.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-destructive font-bold text-lg">접근 권한이 없습니다.</p>
                <Link href="/notification">
                    <Button variant="outline">돌아가기</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {error && <ErrorModal error={error} onClose={() => setError(null)} />}
            <NotificationWriteForm
                notification={notification}
                onError={(err) => {
                    const supabaseError = err;
                    const errCode = supabaseError?.['code'];
                    setError({
                        ErrName: errCode || "Notification Error",
                        ErrMessage: errCode === "23P01" ? "모달 공지가 겹쳤습니다 (동일 기간에 모달 공지는 하나만 가능합니다)" : (supabaseError?.message || "공지사항 처리에 실패했습니다."),
                        ErrStackRace: supabaseError?.details || null,
                        inputValue: notification?.title || "",
                        HTTPStatus: errCode,
                        location: "NotificationWrite"
                    });
                }}
            />
        </div>
    );
}
