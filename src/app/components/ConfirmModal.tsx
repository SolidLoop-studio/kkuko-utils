'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'

type ConfirmModalProps = {
    title?: string
    description?: string
    open: boolean
    onConfirm: () => void
    onClose: () => void
    isPending?: boolean
}

export default function ConfirmModal({
    title = '정말로 진행하시겠습니까?',
    description = '',
    open,
    onConfirm,
    onClose,
    isPending = false
}: ConfirmModalProps) {
    return (
        <Dialog open={open} onOpenChange={() => { if (!isPending) onClose() }}>
            <DialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100">{title}</DialogTitle>
                    {description && (
                        <DialogDescription className="text-sm text-muted-foreground dark:text-gray-400">
                            {description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <DialogFooter className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        취소
                    </Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600"
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? '처리 중...' : '확인'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
