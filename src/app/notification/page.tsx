import { createPublicNotificationServices } from "@/src/modules/notifications/infrastructure/server/server-notification-services";
import Notification from "./Notification";
import { type Metadata } from "next";

export const metadata: Metadata = {
    title: "공지사항 - 끄코 유틸",
    description: "끄코 유틸의 공지사항 목록입니다.",
};

export const revalidate = 60;

/**
 * 공지사항 페이지 컴포넌트입니다.
 * 서버 사이드에서 데이터를 가져와 Notification 클라이언트 컴포넌트에 전달합니다.
 */
export default async function NotificationPage() {
    const { notificationListQueryService } = createPublicNotificationServices();
    const result = await notificationListQueryService.get();

    if (!result.ok) {
        console.error(result.error.message);
    }

    return (
        <main className="container mx-auto py-8">
            <Notification
                notifications={result.ok ? result.value : []}
                initialError={result.ok ? null : result.error.message}
            />
        </main>
    );
}
