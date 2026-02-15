"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/app/components/ui/dialog";
import { Button } from "@/src/app/components/ui/button";
import { useRouter } from "next/navigation";

interface WordAddModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WordAddModal = ({ isOpen, onClose }: WordAddModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-2xl h-auto p-6 flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100">단어 추가</DialogTitle>
                </DialogHeader>
                <div>
                    <AddWordForm />
                </div>
            </DialogContent>
        </Dialog>
    )
}

const AddWordForm = () => {
    const router = useRouter();
    const onMoveToAddPage = () => {
        router.push('/word/add');
    };

    // 동적 ui모달창 만들기 귀찮아서 그냥 단어 추가 페이지로 이동시키기
    return (
        <div className="space-y-3 overflow-y-auto w-full max-w-[600px] mx-auto p-4 text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">단어 추가는 별도 페이지에서 진행됩니다.</div>
            <div className="text-sm text-muted-foreground dark:text-gray-400">페이지로 이동해서 단어를 입력해주세요.</div>
            <Button onClick={onMoveToAddPage} className="w-full bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800">
                단어 추가 페이지로 이동
            </Button>
        </div>
    )
}

export default WordAddModal;