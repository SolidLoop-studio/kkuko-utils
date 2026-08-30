"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/app/components/ui/dialog";
import { Button } from "@/src/app/components/ui/button";
import { XCircle } from "lucide-react";

interface ErrorModalProps {
    open: boolean;
    title?: string;
    description: string;
    onClose: () => void;
}

export default function FailModal({ open, title = "작업을 완료할 수 없습니다", description, onClose }: ErrorModalProps) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <DialogHeader className="flex flex-col items-center justify-center gap-2">
                    <XCircle className="text-red-500 dark:text-red-400" size={48} />
                    <DialogTitle className="text-lg text-gray-900 dark:text-white">{title}</DialogTitle>
                </DialogHeader>
                <DialogDescription className="py-2 text-sm text-gray-600 dark:text-gray-300">
                    {description}
                </DialogDescription>
                <Button className="mt-4 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white" onClick={onClose}>
                    확인
                </Button>
            </DialogContent>
        </Dialog>
    );
}
