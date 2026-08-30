'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, FileText, Loader2, Upload } from 'lucide-react';

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/src/app/components/ui/alert-dialog';
import { Button } from '@/src/app/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/src/app/components/ui/dialog';
import { Progress } from '@/src/app/components/ui/progress';
import { Textarea } from '@/src/app/components/ui/textarea';
import type {
    DeletionProgress,
    RawWordDeletionEntry,
    StoredWordDeletionJob,
    WordDeletionRunResult,
} from '@/src/modules/word-moderation';
import type { ApplicationError } from '@/src/shared/application/application-error';

export interface WordDeletionViewModel {
    start(entries: RawWordDeletionEntry[]): void | Promise<unknown>;
    resume(operationId: string): void | Promise<unknown>;
    cancel(operationId: string): void | Promise<unknown>;
    clearError(): void;
    pendingJobs: StoredWordDeletionJob[];
    progress: DeletionProgress | null;
    result: WordDeletionRunResult | null;
    error: ApplicationError | null;
    isPending: boolean;
}

export interface WordDeletionPanelProps {
    deletion: WordDeletionViewModel;
}

const applicationErrorMessage = (error: ApplicationError): string => {
    switch (error.kind) {
        case 'validation': return error.message;
        case 'unauthorized': return '로그인이 필요합니다.';
        case 'forbidden': return '관리자 권한이 필요합니다.';
        case 'not-found': return '저장된 삭제 작업을 찾을 수 없습니다.';
        case 'conflict': return '삭제 작업 상태가 변경되었습니다. 다시 확인해 주세요.';
        case 'infrastructure': return '단어 삭제 작업 처리 중 오류가 발생했습니다.';
    }
};

const errorMessage = (name: string, message: string): ErrorMessage => ({
    ErrName: name,
    ErrMessage: message,
    ErrStackRace: null,
    inputValue: null,
});

const stageLabel = (stage: DeletionProgress['stage']): string => {
    switch (stage) {
        case 'validating': return '입력 검증 중';
        case 'applying': return '삭제 적용 중';
        case 'finalizing': return '마무리 중';
        case 'completed': return '처리 완료!';
    }
};

const progressPercent = (progress: DeletionProgress | null): number => {
    if (progress === null || progress.totalEntries === 0) return 0;
    return Math.round((progress.completedEntries / progress.totalEntries) * 100);
};

const isRestorableFocusTarget = (element: Element | null): element is HTMLElement => (
    element instanceof HTMLElement
    && element !== document.body
    && element.isConnected
    && !element.matches(':disabled')
);

export default function WordDeletionPanel({ deletion }: WordDeletionPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [isReading, setIsReading] = useState(false);
    const [isActionPending, setIsActionPending] = useState(false);
    const [isRunRequested, setIsRunRequested] = useState(false);
    const [isProgressDismissed, setIsProgressDismissed] = useState(false);
    const [isResultDismissed, setIsResultDismissed] = useState(false);
    const [visibleError, setVisibleError] = useState<ErrorMessage | null>(null);
    const activeReaderRef = useRef<FileReader | null>(null);
    const readGenerationRef = useRef(0);
    const focusBeforeErrorRef = useRef<HTMLElement | null>(null);
    const fileUploadControlRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const isBusy = deletion.isPending || isActionPending;

    const captureErrorFocusOrigin = (fallback?: Element | null) => {
        if (visibleError !== null || deletion.error !== null) return;

        const activeElement = document.activeElement;
        const fallbackElement = fallback ?? null;
        if (isRestorableFocusTarget(activeElement)) {
            focusBeforeErrorRef.current = activeElement;
        } else if (isRestorableFocusTarget(fallbackElement)) {
            focusBeforeErrorRef.current = fallbackElement;
        }
    };

    useEffect(() => {
        if (deletion.error !== null) {
            setVisibleError(errorMessage('삭제 작업 오류', applicationErrorMessage(deletion.error)));
        }
    }, [deletion.error]);

    useEffect(() => {
        if (deletion.result !== null) {
            setIsResultDismissed(false);
        }
    }, [deletion.result]);

    useEffect(() => () => {
        readGenerationRef.current += 1;
        const activeReader = activeReaderRef.current;
        activeReaderRef.current = null;
        if (activeReader?.readyState === FileReader.LOADING) activeReader.abort();
    }, []);

    const readFile = (nextFile: File, focusOrigin?: Element | null) => {
        if (isBusy) return;

        captureErrorFocusOrigin(focusOrigin);

        readGenerationRef.current += 1;
        const generation = readGenerationRef.current;
        const previousReader = activeReaderRef.current;
        activeReaderRef.current = null;
        if (previousReader?.readyState === FileReader.LOADING) previousReader.abort();

        setFile(nextFile);
        setFileName(nextFile.name);
        setFileContent('');
        setVisibleError(null);
        deletion.clearError();
        setIsReading(true);
        setIsProgressDismissed(true);
        setIsResultDismissed(true);

        const reader = new FileReader();
        activeReaderRef.current = reader;
        const isCurrentRead = () => readGenerationRef.current === generation && activeReaderRef.current === reader;
        const finishRead = () => {
            if (!isCurrentRead()) return false;
            activeReaderRef.current = null;
            setIsReading(false);
            return true;
        };

        reader.onload = () => {
            if (!isCurrentRead()) return;
            setFileContent(String(reader.result ?? ''));
            finishRead();
        };
        reader.onerror = () => {
            if (!finishRead()) return;
            setFile(null);
            setVisibleError(errorMessage('파일 읽기 오류', '파일을 읽는 중 오류가 발생했습니다.'));
        };
        reader.onabort = () => {
            if (!finishRead()) return;
            setFile(null);
            setVisibleError(errorMessage('파일 읽기 오류', '파일 읽기가 취소되었습니다.'));
        };
        try {
            reader.readAsText(nextFile);
        } catch {
            if (finishRead()) {
                setFile(null);
                setVisibleError(errorMessage('파일 읽기 오류', '파일을 읽는 중 오류가 발생했습니다.'));
            }
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isBusy) return;

        const selectedFile = event.target.files?.[0];
        event.currentTarget.value = '';
        if (selectedFile) readFile(selectedFile, fileUploadControlRef.current);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (isBusy) return;

        const droppedFile = event.dataTransfer.files?.[0];
        if (droppedFile) readFile(droppedFile, event.currentTarget);
    };

    const runAction = async (action: () => void | Promise<unknown>, showsProgress: boolean) => {
        captureErrorFocusOrigin();
        setVisibleError(null);
        setIsActionPending(true);
        if (showsProgress) {
            setIsRunRequested(true);
            setIsProgressDismissed(false);
        }
        try {
            await action();
        } finally {
            setIsActionPending(false);
            setIsRunRequested(false);
        }
    };

    const progress = deletion.progress;
    const percent = progressPercent(progress);
    const isCompleted = progress?.stage === 'completed';
    const isProgressOpen = deletion.error === null
        && visibleError === null
        && !isProgressDismissed
        && (isRunRequested || deletion.isPending || progress !== null);

    const handleProcess = async () => {
        captureErrorFocusOrigin();
        if (file === null) {
            setVisibleError(errorMessage('파일 업로드 오류', '처리할 파일을 먼저 업로드해주세요.'));
            return;
        }
        if (isReading || isBusy) return;
        const entries = fileContent.split('\n').map((word) => ({ word }));
        await runAction(() => deletion.start(entries), true);
    };

    return (
        <>
            {deletion.pendingJobs.length > 0 && (
                <section className="mb-8 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">중단된 작업</h2>
                    <div className="space-y-3">
                        {deletion.pendingJobs.map((job) => (
                            <PendingJob
                                key={job.operationId}
                                job={job}
                                isBusy={isBusy}
                                onResume={() => runAction(() => deletion.resume(job.operationId), true)}
                                onCancel={() => runAction(() => deletion.cancel(job.operationId), false)}
                            />
                        ))}
                    </div>
                </section>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-transparent dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">파일 업로드</h2>
                <div
                    ref={fileUploadControlRef}
                    role="button"
                    tabIndex={isBusy ? -1 : 0}
                    aria-disabled={isBusy}
                    aria-label="파일 업로드 영역"
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-gray-900"
                    onClick={(event) => {
                        if (event.target === fileInputRef.current) return;
                        if (!isBusy) {
                            captureErrorFocusOrigin(fileUploadControlRef.current);
                            fileInputRef.current?.click();
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (!isBusy) {
                            captureErrorFocusOrigin(fileUploadControlRef.current);
                            fileInputRef.current?.click();
                        }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        id="word-deletion-file-upload"
                        type="file"
                        aria-label="클릭하여 파일 업로드"
                        onChange={handleFileChange}
                        disabled={isBusy}
                        className="hidden"
                        accept=".txt,.csv,.md,.json"
                    />
                    <div className="flex flex-col items-center gap-3">
                        <Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {fileName ? `${fileName} 선택됨` : '파일을 드래그하거나 클릭하여 업로드'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">지원 형식: TXT, CSV, MD, JSON</p>
                    </div>
                </div>
                {isReading && <p className="mt-4 text-sm text-gray-500">파일을 읽는 중...</p>}
                {fileContent && (
                    <div className="mt-6">
                        <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <FileText className="h-5 w-5" />파일 미리보기
                        </h3>
                        <Textarea
                            value={fileContent.length > 1000 ? `${fileContent.substring(0, 1000)}...` : fileContent}
                            readOnly
                            className="font-mono text-sm h-48 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                )}
                <div className="mt-6 flex justify-end">
                    <Button onClick={handleProcess} disabled={file === null || isReading || isBusy} className="px-6">
                        {isBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />처리 중...</> : '파일 처리'}
                    </Button>
                </div>
            </div>

            {deletion.result !== null && !isResultDismissed && (
                <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700">
                    <div className="flex items-center gap-2 text-green-600 mb-4">
                        <CheckCircle className="h-6 w-6" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">처리 완료!</h2>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">삭제 처리가 완료되었습니다</p>
                    <dl className="mt-4 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <div>삭제된 단어: {deletion.result.deletedWordCount}개</div>
                        <div>보호된 단어: {deletion.result.protectedWordCount}개</div>
                        <div>없는 단어: {deletion.result.missingWordCount}개</div>
                        <div>처리된 요청: {deletion.result.processedRequestCount}개</div>
                    </dl>
                </section>
            )}

            <AlertDialog
                open={isProgressOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen && !isBusy && isCompleted) setIsProgressDismissed(true);
                }}
            >
                <AlertDialogContent className="max-w-md bg-white dark:bg-gray-900">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                            {isCompleted ? '처리 완료' : '처리 진행 중'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 text-sm text-muted-foreground dark:text-gray-300">
                                <p className="font-medium">{progress ? stageLabel(progress.stage) : '작업 준비 중'}</p>
                                <div className="space-y-2">
                                    <Progress value={percent} className="h-2" />
                                    <div className="flex justify-between text-xs">
                                        <span>단어 {progress?.completedEntries ?? 0}/{progress?.totalEntries ?? 0}</span>
                                        <span>배치 {progress?.completedBatches ?? 0}/{progress?.totalBatches ?? 0}</span>
                                    </div>
                                    <p className="text-right text-xs">{percent}% 완료</p>
                                </div>
                                {isCompleted && (
                                    <div className="flex justify-center text-green-600 dark:text-green-400">
                                        <CheckCircle className="mr-2 h-5 w-5" />
                                        <span>처리가 완료되었습니다!</span>
                                    </div>
                                )}
                                {isCompleted && !isBusy && (
                                    <div className="flex justify-end">
                                        <Button onClick={() => setIsProgressDismissed(true)}>확인</Button>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={visibleError !== null}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setVisibleError(null);
                        deletion.clearError();
                    }
                }}
            >
                <DialogContent
                    className="max-w-sm bg-white text-center dark:bg-gray-800"
                    onCloseAutoFocus={(event) => {
                        const focusTarget = focusBeforeErrorRef.current;
                        focusBeforeErrorRef.current = null;
                        if (isRestorableFocusTarget(focusTarget)) {
                            event.preventDefault();
                            focusTarget.focus();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100">
                            {visibleError?.ErrName ?? '삭제 작업 오류'}
                        </DialogTitle>
                        <DialogDescription className="text-gray-700 dark:text-gray-300">
                            {visibleError?.ErrMessage}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                        <Button onClick={() => {
                            setVisibleError(null);
                            deletion.clearError();
                        }}>
                            확인
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

interface PendingJobProps {
    job: StoredWordDeletionJob;
    isBusy: boolean;
    onResume(): void | Promise<unknown>;
    onCancel(): void | Promise<unknown>;
}

function PendingJob({ job, isBusy, onResume, onCancel }: PendingJobProps) {
    return (
        <div className="flex flex-col gap-3 rounded-md bg-white p-3 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
                <p>작업 ID: {job.operationId}</p>
                <p>생성: {job.createdAt}</p>
                <p>{job.entries.length}개 단어</p>
            </div>
            <div className="flex gap-2">
                <Button aria-label={`${job.operationId} 작업 재개`} onClick={onResume} disabled={isBusy}>작업 재개</Button>
                <Button aria-label={`${job.operationId} 작업 취소`} variant="outline" onClick={onCancel} disabled={isBusy}>작업 취소</Button>
            </div>
        </div>
    );
}
