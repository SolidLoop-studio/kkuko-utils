'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle, FileJson } from 'lucide-react';
import Link from 'next/link';

import ErrorModal from '@/src/app/components/ErrModal';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/src/app/components/ui/alert-dialog';
import { Button } from '@/src/app/components/ui/button';
import { Progress } from '@/src/app/components/ui/progress';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type {
    ApprovalProgress,
    RawWordApprovalEntry,
    StoredWordApprovalJob,
} from '@/src/modules/word-moderation';

import JsonViewer from './JosnViewer';

export interface WordApprovalPanelProps {
    onStart?: (entries: RawWordApprovalEntry[]) => void | Promise<unknown>;
    onResume?: (operationId: string) => void | Promise<unknown>;
    onCancel?: (operationId: string) => void | Promise<unknown>;
    approvalState: {
        pendingJobs: StoredWordApprovalJob[];
        isPendingJobsLoading: boolean;
        progress: ApprovalProgress | null;
        isProcessing: boolean;
        error: ApplicationError | null;
    };
    canManage?: boolean;
}

const applicationErrorMessage = (error: ApplicationError): string => {
    switch (error.kind) {
        case 'validation':
            return error.message;
        case 'unauthorized':
            return '로그인이 필요합니다.';
        case 'forbidden':
            return '관리자 권한이 필요합니다.';
        case 'not-found':
            return '저장된 승인 작업을 찾을 수 없습니다.';
        case 'conflict':
            return '승인 작업 상태가 변경되었습니다. 다시 확인해 주세요.';
        case 'infrastructure':
            return '단어 승인 작업 처리 중 오류가 발생했습니다.';
    }
};

const errorMessage = (name: string, message: string): ErrorMessage => ({
    ErrName: name,
    ErrMessage: message,
    ErrStackRace: null,
    inputValue: null,
});

const isWordEntries = (value: unknown): value is Record<string, string[]> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    return Object.values(value).every(
        (themeCodes) => Array.isArray(themeCodes)
            && themeCodes.every((themeCode) => typeof themeCode === 'string'),
    );
};

const stageLabel = (stage: ApprovalProgress['stage']): string => {
    switch (stage) {
        case 'validating':
            return '입력 검증 중';
        case 'applying':
            return '승인 적용 중';
        case 'finalizing':
            return '마무리 중';
        case 'completed':
            return '완료';
    }
};

const progressPercent = (progress: ApprovalProgress | null): number => {
    if (progress === null || progress.totalEntries === 0) {
        return 0;
    }

    return Math.round((progress.completedEntries / progress.totalEntries) * 100);
};

export default function WordApprovalPanel({
    onStart,
    onResume,
    onCancel,
    approvalState,
    canManage = true,
}: WordApprovalPanelProps) {
    const [entries, setEntries] = useState<RawWordApprovalEntry[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [visibleError, setVisibleError] = useState<ErrorMessage | null>(null);
    const [isReading, setIsReading] = useState(false);
    const [isActionPending, setIsActionPending] = useState(false);
    const [isRunRequested, setIsRunRequested] = useState(false);
    const [isProgressDismissed, setIsProgressDismissed] = useState(false);
    const activeReaderRef = useRef<FileReader | null>(null);
    const readGenerationRef = useRef(0);

    useEffect(() => {
        if (approvalState.error !== null) {
            setVisibleError(errorMessage(
                '승인 작업 오류',
                applicationErrorMessage(approvalState.error),
            ));
        }
    }, [approvalState.error]);

    useEffect(() => () => {
        readGenerationRef.current += 1;
        const activeReader = activeReaderRef.current;
        activeReaderRef.current = null;
        if (activeReader?.readyState === FileReader.LOADING) {
            activeReader.abort();
        }
    }, []);

    const parseFile = (file: File) => {
        readGenerationRef.current += 1;
        const generation = readGenerationRef.current;
        const previousReader = activeReaderRef.current;
        activeReaderRef.current = null;
        if (previousReader?.readyState === FileReader.LOADING) {
            previousReader.abort();
        }

        setFileName(file.name);
        setEntries(null);
        setVisibleError(null);
        setIsReading(true);
        const reader = new FileReader();
        activeReaderRef.current = reader;

        const isCurrentRead = () => readGenerationRef.current === generation
            && activeReaderRef.current === reader;

        const finishRead = () => {
            if (!isCurrentRead()) {
                return false;
            }
            activeReaderRef.current = null;
            setIsReading(false);
            return true;
        };

        reader.onload = () => {
            if (!isCurrentRead()) {
                return;
            }
            try {
                const parsed: unknown = JSON.parse(String(reader.result ?? ''));
                if (!isWordEntries(parsed)) {
                    setEntries(null);
                    setVisibleError(errorMessage(
                        'JSON 파일 오류',
                        '데이터 형식이 올바르지 않습니다.',
                    ));
                    return;
                }

                setEntries(Object.entries(parsed).map(([word, themeCodes]) => ({
                    word,
                    themeCodes,
                })));
                setVisibleError(null);
            } catch {
                setEntries(null);
                setVisibleError(errorMessage(
                    'JSON 파일 오류',
                    'JSON 파일 파싱 중 오류가 발생했거나 형식이 올바르지 않습니다.',
                ));
            } finally {
                finishRead();
            }
        };

        reader.onerror = () => {
            if (!finishRead()) {
                return;
            }
            setEntries(null);
            setVisibleError(errorMessage(
                'JSON 파일 오류',
                'JSON 파일을 읽는 중 오류가 발생했습니다.',
            ));
        };

        reader.onabort = () => {
            if (!finishRead()) {
                return;
            }
            setEntries(null);
            setVisibleError(errorMessage(
                'JSON 파일 오류',
                'JSON 파일 읽기가 취소되었습니다.',
            ));
        };

        try {
            reader.readAsText(file);
        } catch {
            if (finishRead()) {
                setEntries(null);
                setVisibleError(errorMessage(
                    'JSON 파일 오류',
                    'JSON 파일을 읽는 중 오류가 발생했습니다.',
                ));
            }
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.currentTarget.value = '';
        if (file) {
            parseFile(file);
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files?.[0];
        if (file) {
            parseFile(file);
        }
    };

    const runAction = async (action: () => void | Promise<unknown>, showsProgress: boolean) => {
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

    const handleStart = async () => {
        if (
            approvalState.isPendingJobsLoading
            || isReading
            || entries === null
            || onStart === undefined
        ) {
            return;
        }
        await runAction(() => onStart(entries), true);
    };

    const isBusy = approvalState.isProcessing || isActionPending;
    const progress = approvalState.progress;
    const percent = progressPercent(progress);
    const isCompleted = progress?.stage === 'completed';
    const isProgressOpen = approvalState.error === null
        && visibleError === null
        && !isProgressDismissed
        && (isRunRequested || approvalState.isProcessing || progress !== null);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 p-6 dark:from-gray-900 dark:to-gray-800">
            <div className="w-full max-w-3xl rounded-lg border border-transparent bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
                <Link href="/admin" className="mb-4 flex">
                    <Button variant="outline">
                        <ArrowLeft />
                        관리자 대시보드로 이동
                    </Button>
                </Link>
                <h1 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
                    JSON 파일 처리
                </h1>

                {!canManage && (
                    <div className="mb-6 flex items-start rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900">
                        <AlertCircle className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                        <p className="text-amber-800 dark:text-amber-100">관리자 권한이 필요합니다.</p>
                    </div>
                )}

                {approvalState.pendingJobs.length > 0 && (
                    <section className="mb-8 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            중단된 작업
                        </h2>
                        <div className="space-y-3">
                            {approvalState.pendingJobs.map((job) => (
                                <div
                                    key={job.operationId}
                                    className="flex flex-col gap-3 rounded-md bg-white p-3 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                        <p>작업 ID: {job.operationId}</p>
                                        <p>{job.entries.length}개 단어</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            aria-label={`${job.operationId} 작업 재개`}
                                            onClick={() => onResume
                                                && runAction(() => onResume(job.operationId), true)}
                                            disabled={!canManage || isBusy || onResume === undefined}
                                        >
                                            작업 재개
                                        </Button>
                                        <Button
                                            aria-label={`${job.operationId} 작업 취소`}
                                            variant="outline"
                                            onClick={() => onCancel
                                                && runAction(() => onCancel(job.operationId), false)}
                                            disabled={!canManage || isBusy || onCancel === undefined}
                                        >
                                            작업 취소
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="mb-8">
                    <div className="flex w-full items-center justify-center">
                        <label
                            htmlFor="file-upload"
                            aria-busy={isReading}
                            className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
                            onDragOver={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onDrop={handleDrop}
                        >
                            <div className="flex flex-col items-center justify-center pb-6 pt-5">
                                <FileJson className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500" />
                                <p className="mb-2 text-sm text-gray-500 dark:text-gray-300">
                                    <span className="font-semibold">클릭하여 파일 업로드</span>{' '}
                                    또는 드래그 앤 드롭
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    JSON 파일만 가능합니다
                                </p>
                                {fileName && (
                                    <span className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                                        {fileName} 선택됨
                                    </span>
                                )}
                            </div>
                            <input
                                id="file-upload"
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>
                </div>

                {entries !== null && (
                    <div className="mb-8 rounded-md bg-gray-50 p-4 dark:bg-gray-900">
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            업로드된 JSON 데이터
                        </h2>
                        <div className="h-60">
                            <JsonViewer
                                data={entries.map(({ word, themeCodes }) => ({
                                    word,
                                    themes: themeCodes,
                                }))}
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <Button
                        onClick={handleStart}
                        disabled={!canManage
                            || approvalState.isPendingJobsLoading
                            || isReading
                            || entries === null
                            || isBusy
                            || onStart === undefined}
                        className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                    >
                        {isBusy ? '처리 중...' : '처리 시작'}
                    </Button>
                </div>
            </div>

            <AlertDialog
                open={isProgressOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen && !isBusy) {
                        setIsProgressDismissed(true);
                    }
                }}
            >
                <AlertDialogContent className="max-w-md bg-white dark:bg-gray-900">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                            {isCompleted ? '처리 완료' : '처리 중...'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 text-sm text-muted-foreground dark:text-gray-300">
                                <p className="font-medium">
                                    {progress ? stageLabel(progress.stage) : '작업 준비 중'}
                                </p>
                                <div className="space-y-2">
                                    <Progress value={percent} className="h-2" />
                                    <div className="flex justify-between text-xs">
                                        <span>
                                            단어 {progress?.completedEntries ?? 0}/{progress?.totalEntries ?? 0}
                                        </span>
                                        <span>
                                            배치 {progress?.completedBatches ?? 0}/{progress?.totalBatches ?? 0}
                                        </span>
                                    </div>
                                    <p className="text-right text-xs">{percent}% 완료</p>
                                </div>

                                {isCompleted && (
                                    <div className="flex justify-center text-green-600 dark:text-green-400">
                                        <CheckCircle className="mr-2 h-5 w-5" />
                                        <span>처리가 완료되었습니다!</span>
                                    </div>
                                )}

                                {isCompleted && (
                                    <div className="flex justify-end">
                                        <Button onClick={() => setIsProgressDismissed(true)}>확인</Button>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>

            {visibleError && (
                <ErrorModal error={visibleError} onClose={() => setVisibleError(null)} />
            )}
        </div>
    );
}
