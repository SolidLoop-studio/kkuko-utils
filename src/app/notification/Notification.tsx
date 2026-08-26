"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/src/app/components/ui/card";
import { Badge } from "@/src/app/components/ui/badge";
import { Bell, Calendar, Megaphone, Pin, PenSquare } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { NotificationListItem } from "@/src/modules/notifications";
import Link from "next/link";
import { cn } from "@/src/app/lib/utils";
import { useSelector } from "react-redux";
import { Button } from "@/src/app/components/ui/button";
import type { RootState } from "../store/store";

interface NotificationProps {
    notifications: NotificationListItem[];
}

/**
 * 공지사항 목록을 표시하는 컴포넌트입니다.
 * 중요 공지사항은 상단에 고정되며 강조 표시됩니다.
 * 관리자는 글쓰기 버튼이 노출됩니다.
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {NotificationListItem[]} props.notifications - 정렬된 활성 공지사항 데이터 배열
 */
export default function Notification({ notifications }: NotificationProps) {
    const user = useSelector((state: RootState) => state.user);

    return (
        <div className="space-y-6 px-4 md:px-0 max-w-4xl mx-auto min-h-[60vh]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                     <Bell className="w-6 h-6 text-primary" />
                     <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
                </div>
                {user.role === "admin" && (
                    <Link href="/notification/write">
                        <Button size="sm" className="gap-2">
                            <PenSquare className="w-4 h-4" />
                            작성하기
                        </Button>
                    </Link>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-muted-foreground">
                    <Megaphone className="w-12 h-12 opacity-20" />
                    <p>등록된 공지사항이 없습니다.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {notifications.map((notice) => (
                        <Link key={notice.id} href={`/notification/${notice.id}`}>
                            <Card 
                                className={cn(
                                    "transition-all hover:shadow-md cursor-pointer dark:border-zinc-800",
                                    notice.isImportant && "border-primary/50 bg-primary/5 dark:bg-primary/10"
                                )}
                            >
                                <CardHeader className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {notice.isImportant ? (
                                                 <Pin className="w-4 h-4 text-primary shrink-0 rotate-45 fill-primary" />
                                            ) : (
                                                <div className="w-4" /> 
                                            )}
                                            <div className="space-y-1 truncate">
                                                <div className="flex items-center gap-2">
                                                    {notice.isImportant && <Badge variant="default" className="text-xs h-5 px-1.5">필독</Badge>}
                                                    <CardTitle className="text-base sm:text-lg truncate">{notice.title}</CardTitle>
                                                </div>
                                                <CardDescription className="flex items-center gap-1 text-xs">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(notice.createdAt), "yyyy-MM-dd", { locale: ko })}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
