import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { SupabaseClientManager } from "@/lib/supabase/SupabaseClientManager";
import Notification from "./Notification";
import { type Metadata } from "next";

export const metadata: Metadata = {
    title: "공지사항 - 끄코 유틸",
    description: "끄코 유틸의 공지사항 목록입니다.",
};

/**
 * 공지사항 페이지 컴포넌트입니다.
 * 서버 사이드에서 데이터를 가져와 Notification 클라이언트 컴포넌트에 전달합니다.
 */
export default async function NotificationPage() {
    const supabase = await createSupabaseServerClient();
    const scm = new SupabaseClientManager(supabase);
    const { data: notifications, error } = await scm.get().allNotifications();

    if (error) {
        console.error("Failed to fetch notifications:", error);
    }

    return (
        <main className="container mx-auto py-8">
            <Notification notifications={notifications || []} />
        </main>
    );
}
