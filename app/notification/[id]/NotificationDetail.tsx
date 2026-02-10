"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, Pin, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Database } from "@/types/database.types";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { SCM } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ErrorModal from "@/components/ErrModal";
import type { ErrorMessage } from "@/types/type";
import ConfirmModal from "@/components/ConfirmModal";
import { PostgrestError } from "@supabase/supabase-js";
import CompleteModal from "@/app/components/CompleteModal";

type NotificationType = Database['public']['Tables']['notification']['Row'];

interface NotificationDetailProps {
    notification: NotificationType;
}

/**
 * 공지사항 상세 내용을 표시하는 컴포넌트입니다.
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {NotificationType} props.notification - 표시할 공지사항 데이터
 */
export default function NotificationDetail({ notification }: NotificationDetailProps) {
    const user = useSelector((state: RootState) => state.user);
    const router = useRouter();
    const [error, setError] = useState<ErrorMessage | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [completeStatus, setCompleteStatus] = useState<{title: string; description: string;} | null>(null);

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            const { error } = await SCM.delete().notificationById(notification.id);
            
            if (error) throw error;
            
            setCompleteStatus({
                title: "공지사항이 삭제되었습니다.",
                description: "공지사항이 성공적으로 삭제되었습니다. 목록으로 돌아갑니다."
            });
        } catch (error) {
            console.error("Delete failed:", error);
            const pgError = error as PostgrestError;
            setError({
                ErrName: pgError.code || "Delete Error",
                ErrMessage: pgError.message || "공지사항 삭제에 실패했습니다.",
                ErrStackRace: pgError.details,
                inputValue: `Delete ID: ${notification.id}`,
                location: "NotificationDetail"
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const handleCloseCompleteModal = () => {
        router.push("/notification");
        router.refresh();
    };

    return (
        <div className="space-y-6 px-4 md:px-0 max-w-4xl mx-auto">
            {error && <ErrorModal error={error} onClose={() => setError(null)} />}
            {completeStatus && (
                <CompleteModal 
                    open={completeStatus !== null}
                    title={completeStatus.title}
                    description={completeStatus.description}
                    onClose={handleCloseCompleteModal}
                />
            )}
            <ConfirmModal 
                open={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="공지사항 삭제"
                description="이 공지사항을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                onConfirm={handleDelete}
                
            />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Link href="/notification">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight">공지사항 상세</h1>
                </div>

                {user.role === "admin" && (
                    <div className="flex gap-2">
                        <Link href={`/notification/${notification.id}/edit`}>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Edit className="w-4 h-4" />
                                수정
                            </Button>
                        </Link>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => setIsDeleteModalOpen(true)}
                            disabled={isDeleting}
                        >
                            <Trash2 className="w-4 h-4" />
                            삭제
                        </Button>
                    </div>
                )}
            </div>

            <Card className="dark:border-zinc-800">
                <CardHeader className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {notification.is_important && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-1">
                                    <Pin className="w-3 h-3 fill-primary" />
                                    필독
                                </Badge>
                            )}
                            {notification.is_modal && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    팝업 공지
                                </Badge>
                            )}
                        </div>
                        <CardTitle className="text-2xl font-bold leading-tight">{notification.title}</CardTitle>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(notification.created_at), "yyyy년 M월 d일 a h:mm", { locale: ko })}</span>
                    </div>
                </CardHeader>
                
                <Separator />
                
                <CardContent className="pt-6">
                    <div className="text-base leading-relaxed text-foreground min-h-[100px] [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mb-2 [&>p]:mb-4 [&>a]:text-primary [&>a]:underline [&>blockquote]:border-l-4 [&>blockquote]:pl-4 [&>blockquote]:italic">
                        <ReactMarkdown>{notification.body}</ReactMarkdown>
                    </div>
                    
                    {notification.img && (
                        <div className="mt-8 rounded-lg overflow-hidden border bg-muted/50">
                            <div className="relative w-full aspect-video max-w-2xl mx-auto">
                                <Image 
                                    src={notification.img} 
                                    alt={notification.title} 
                                    className="object-contain" 
                                    fill 
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 700px"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-center pt-4 pb-8">
                <Link href="/notification">
                    <Button variant="outline" className="px-8">목록으로 돌아가기</Button>
                </Link>
            </div>
        </div>
    );
}
