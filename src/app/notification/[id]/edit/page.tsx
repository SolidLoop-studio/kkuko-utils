import ErrorPage from "@/src/app/components/ErrorPage";
import { parseNotificationRouteId } from "@/src/modules/notifications/application/parse-notification-route-id";
import { getServerNotificationDetail } from "@/src/modules/notifications/infrastructure/server/server-notification-services";
import NotificationWrite from "../../write/NotificationWrite";
import { notFound } from "next/navigation";
import { type Metadata } from "next";

interface PageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "공지사항 수정 - 끄코 유틸",
};

export default async function NotificationEditPage({ params }: PageProps) {
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
        <main className="container mx-auto py-8 px-4">
            <NotificationWrite notification={result.value} />
        </main>
    );
}
