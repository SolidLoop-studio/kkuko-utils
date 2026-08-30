import ErrorPage from "@/src/app/components/ErrorPage";
import { parseNotificationRouteId } from "@/src/modules/notifications/application/parse-notification-route-id";
import { getServerNotificationDetail } from "@/src/modules/notifications/infrastructure/server/server-notification-services";
import NotificationDetail from "./NotificationDetail";
import { notFound } from "next/navigation";
import { type Metadata } from "next";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const notificationId = parseNotificationRouteId(id);
    if (notificationId === null) {
        return {
            title: "공지사항을 찾을 수 없습니다",
        };
    }
    const result = await getServerNotificationDetail(notificationId);

    if (!result.ok) {
        if (result.error.kind === 'infrastructure') {
            return {
                title: "공지사항 - 끄코 유틸",
                description: "끄코 유틸의 공지사항입니다.",
            };
        }
        return {
            title: "공지사항을 찾을 수 없습니다",
        };
    }

    return {
        title: `${result.value.title} - 공지사항`,
        description: `끄코 유틸 공지사항: ${result.value.title}`,
    };
}

/**
 * 공지사항 상세 페이지입니다.
 */
export default async function NotificationDetailPage({ params }: PageProps) {
    const { id } = await params;
    const notificationId = parseNotificationRouteId(id);
    if (notificationId === null) notFound();
    const result = await getServerNotificationDetail(notificationId);

    if (!result.ok) {
        if (result.error.kind === 'validation' || result.error.kind === 'not-found') notFound();
        console.error(result.error.message);
        return <ErrorPage message={result.error.message} />;
    }

    return (
        <main className="container mx-auto py-8">
            <NotificationDetail notification={result.value} />
        </main>
    );
}
