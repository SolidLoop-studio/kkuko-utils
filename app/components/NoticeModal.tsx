"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { useState } from "react";
import { Info } from "lucide-react";
import Image from "next/image";
import MarkdownViewer from "./MarkdownViewer";

interface NoticeData {
    id: number;
    title: string;
    body: string;
    img: string | null;
    created_at: string;
}

interface NoticeModalProps {
    open: boolean;
    onClose: () => void;
    notice: NoticeData;
}

export default function NoticeModal({ open, onClose, notice }: NoticeModalProps) {
    const [hideNext, setHideNext] = useState(true);

    const handleClose = () => {
        if (hideNext) {
            // 로컬 스토리지에 숨겨진 공지 ID 저장
            const hiddenNotices = JSON.parse(localStorage.getItem('hiddenNotices') || '[]');
            if (!hiddenNotices.includes(notice.id)) {
                hiddenNotices.push(notice.id);
                localStorage.setItem('hiddenNotices', JSON.stringify(hiddenNotices));
            }
        }
        onClose();
    };

    // 공지 생성 시간 포맷팅
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-500" />
                        <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                            공지사항
                        </DialogTitle>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(notice.created_at)}
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 공지 제목 */}
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                            {notice.title}
                        </h3>
                    </div>

                    {/* 공지 이미지 (있는 경우) */}
                    {notice.img && (
                        <div className="flex justify-center max-h-60 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                            <Image 
                                src={notice.img} 
                                alt="공지 이미지" 
                                width={400}
                                height={240}
                                className="object-contain w-auto h-auto max-h-60"
                                priority
                            />
                        </div>
                    )}

                    {/* 공지 내용 */}
                    <div className="prose prose-sm dark:prose-invert text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-none">
                        <div className="max-h-[54vh] overflow-y-auto pr-2">
                            <MarkdownViewer content={notice.body} />
                        </div>
                    </div>

                    {/* 다음에 미표시 체크박스 */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Checkbox
                            id="hideNext"
                            checked={hideNext}
                            onCheckedChange={(checked) => setHideNext(checked as boolean)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:border-blue-500"
                        />
                        <label 
                            htmlFor="hideNext" 
                            className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                        >
                            다음에 미표시
                        </label>
                    </div>
                </div>

                <DialogFooter>
                    <Button 
                        onClick={handleClose}
                        className="w-full dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                    >
                        확인
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
