import NotificationWrite from "../../write/NotificationWrite";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { SCM } from "@/app/lib/supabaseClient";

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
    
    const { data: notification, error } = await SCM.get().notificationById(notificationId);

    if (error || !notification) {
        if (error) console.error("Error fetching notification for edit:", error);
        notFound();
    }

    return (
        <main className="container mx-auto py-8 px-4">
            <NotificationWrite notification={notification} />
        </main>
    );
}
