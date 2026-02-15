"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/app/components/ui/dialog";
import { Button } from "@/src/app/components/ui/button";
import { useRouter } from "next/navigation";

interface LoginRequiredModalProps {
    open: boolean;
    onClose: () => void;
}

export default function LoginRequiredModal({ open, onClose }: LoginRequiredModalProps) {
    const router = useRouter();

    const handleLogin = () => {
        onClose();
        router.push("/auth");
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">로그인이 필요합니다</DialogTitle>
                </DialogHeader>
                <div className="py-2 text-sm text-gray-600 dark:text-gray-300">
                    이 서비스를 이용하시려면 로그인이 필요합니다.
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose} className="dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                        닫기
                    </Button>
                    <Button onClick={handleLogin} className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white">
                        로그인하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}