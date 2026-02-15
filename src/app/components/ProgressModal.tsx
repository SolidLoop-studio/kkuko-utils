import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/src/app/components/ui/alert-dialog";
import { Button } from "@/src/app/components/ui/button";
import { Progress } from "@/src/app/components/ui/progress";

interface ProgressModalProp {
    isModalOpen: boolean;
    isProcessing: boolean;
    onClose: ()=>void;
    progress: number;
    currentTask: string;
}

export default function ProgressModal({isModalOpen, isProcessing, onClose, progress, currentTask}:ProgressModalProp){
    return (
    <AlertDialog open={isModalOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-md bg-white dark:bg-gray-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                        {isProcessing ? "처리 중..." : "처리 완료"}
                    </AlertDialogTitle>
                    <div className="text-sm text-muted-foreground dark:text-gray-300">
                        <div className="space-y-4">
                            <div className="flex items-center">
                                <p className="text-sm font-medium">{currentTask}</p>
                            </div>

                            <div className="space-y-2">
                                <Progress value={progress} className="h-2" />
                                <p className="text-xs text-right">{progress}% 완료</p>
                            </div>

                            {!isProcessing && (
                                <div className="mt-4 flex justify-end">
                                    <Button onClick={()=>onClose()}>확인</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </AlertDialogHeader>
            </AlertDialogContent>
        </AlertDialog>
    )
}