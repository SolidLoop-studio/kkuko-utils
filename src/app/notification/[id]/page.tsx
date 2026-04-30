import { createSupabaseServerClient } from "@/src/app/lib/supabaseServer";
import NotificationDetail from "./NotificationDetail";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import type { NotificationEntity } from "@/src/lib/services/domain/notification/NotificationEntity";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    
    const { data: notification } = await supabase
        .from('notification')
        .select('title')
        .eq('id', parseInt(id))
        .single();
        
    if (!notification) {
        return {
            title: "공지사항을 찾을 수 없습니다",
        };
    }

    return {
        title: `${notification.title} - 공지사항`,
        description: `끄코 유틸 공지사항: ${notification.title}`,
    };
}

/**
 * 공지사항 상세 페이지입니다.
 */
export default async function NotificationDetailPage({ params }: PageProps) {
    const { id } = await params;
    
    // ID 유효성 검사 (숫자인지 확인)
    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
        notFound();
    }

    const supabase = await createSupabaseServerClient();
    
    // 직접 쿼리하여 데이터 가져오기 (SupabaseClientManager에는 getById가 없으므로)
    const { data: notification, error } = await supabase
        .from('notification')
        .select('*')
        .eq('id', notificationId)
        .single();

    if (error || !notification) {
        if (error) console.error("Error fetching notification:", error);
        notFound();
    }

    const notificationEntity: NotificationEntity = {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        img: notification.img ?? null,
        endAt: notification.end_at,
        isImportant: notification.is_important ?? false,
        isModal: notification.is_modal ?? false,
        createdAt: notification.created_at,
    };

    return (
        <main className="container mx-auto py-8">
            <NotificationDetail notification={notificationEntity} />
        </main>
    );
}
