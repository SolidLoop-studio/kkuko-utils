"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, Pin } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Database } from "@/types/database.types";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

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
    return (
        <div className="space-y-6 px-4 md:px-0 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <Link href="/notification">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-xl font-bold tracking-tight">공지사항 상세</h1>
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
                    <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground min-h-[100px]">
                        {notification.body}
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
