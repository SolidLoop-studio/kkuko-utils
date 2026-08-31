"use client";
import Spinner from "@/src/app/components/Spinner";

export default function LoadingPage({ title }: { title: string }) {
    const message = `${title} 로딩 중...`;

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={message}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/50 text-gray-800 backdrop-blur-sm dark:bg-gray-950/50 dark:text-gray-100"
        >
            <Spinner />
            <p className="text-base font-medium">{message}</p>
        </div>
    );
};
