import NotificationWrite from "../../write/NotificationWrite";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { notificationContainer } from "@/src/app/lib/supabaseClient";

interface PageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "공지사항 수정 - 끄코 유틸",
};

export default async function NotificationEditPage({ params }: PageProps) {
    const { id } = await params;
    const notificationId = parseInt(id);
    
    if (isNaN(notificationId)) {
        notFound();
    }
    
    const result = await notificationContainer.notificationService.getById(notificationId);

    if (!result.success || !result.data) {
        if (!result.success) console.error("Error fetching notification for edit:", result.error);
        notFound();
    }
    const notification = result.data;

    return (
        <main className="container mx-auto py-8 px-4">
            <NotificationWrite notification={notification} />
        </main>
    );
}
