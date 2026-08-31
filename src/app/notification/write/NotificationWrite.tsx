"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/button";
import NotificationWriteForm from "../components/NotificationWriteForm";
import ErrorModal from "@/src/app/components/ErrModal";
import type { ErrorMessage } from "@/src/app/types/type";
import type { NotificationDetailProjection } from "@/src/modules/notifications";
import type { ApplicationError } from "@/src/shared/application/application-error";

interface NotificationWriteProps {
    notification?: NotificationDetailProjection;
}

export default function NotificationWrite({ notification }: NotificationWriteProps) {
    const user = useSelector((state: RootState) => state.user);
    const [error, setError] = useState<ApplicationError | null>(null);
    const modalError: ErrorMessage | null = error === null ? null : {
        component: 'NotificationWrite',
        ErrName: "Notification Error",
        ErrMessage: error.message,
        ErrStackRace: null,
        inputValue: notification?.title ?? "",
        location: "NotificationWrite",
    };

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
            {modalError && <ErrorModal error={modalError} onClose={() => setError(null)} />}
            <NotificationWriteForm
                notification={notification}
                onError={setError}
            />
        </div>
    );
}
