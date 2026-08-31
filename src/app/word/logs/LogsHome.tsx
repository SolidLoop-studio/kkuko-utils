"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Button } from "@/src/app/components/ui/button";
import ErrorModal from "@/src/app/components/ErrModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/app/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/app/components/ui/table";
import { RootState } from "@/src/app/store/store";
import {
    useWordLogPage,
    type WordLogRequestType,
    type WordLogState,
} from '@/src/modules/word-logs';

const itemsPerPage = 30 as const;

export default function LogPage() {
    const [page, setPage] = useState(1);
    const [filterState, setFilterState] = useState<WordLogState | 'all'>('all');
    const [filterType, setFilterType] = useState<WordLogRequestType | 'all'>('all');
    const [isQueryErrorDismissed, setIsQueryErrorDismissed] = useState(false);
    const user = useSelector((state: RootState) => state.user);
    const router = useRouter();
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = {
        page,
        pageSize: itemsPerPage,
        state: filterState,
        requestType: filterType,
    };
    const {
        data,
        error,
        isLoading,
        isFetching,
        isPlaceholderData,
        refetch,
    } = useWordLogPage(query);
    const logs = data?.items ?? [];
    const totalCount = data?.totalCount ?? 0;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const queryError = error === null || isQueryErrorDismissed
        ? null
        : {
            component: 'LogsHome',
            ErrName: '로그 조회 오류',
            ErrMessage: error.message,
            ErrStackRace: '',
            inputValue: '/word/logs',
        };

    const changeState = (state: WordLogState | 'all') => {
        setPage(1);
        setIsQueryErrorDismissed(false);
        setFilterState(state);
    };

    const changeRequestType = (requestType: WordLogRequestType | 'all') => {
        setPage(1);
        setIsQueryErrorDismissed(false);
        setFilterType(requestType);
    };

    const changePage = (nextPage: number) => {
        if (nextPage < 1 || nextPage > totalPages) return;
        setIsQueryErrorDismissed(false);
        setPage(nextPage);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto text-gray-800 dark:text-gray-100 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 min-h-screen">
            {queryError && (
                <ErrorModal
                    error={queryError as ErrorMessage}
                    onClose={() => setIsQueryErrorDismissed(true)}
                />
            )}

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">단어 추가/삭제 로그</h1>
                <Button
                    variant="outline"
                    onClick={() => {
                        setIsQueryErrorDismissed(false);
                        void refetch();
                    }}
                    disabled={isFetching}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    새로고침
                </Button>
            </div>

            <div className="flex gap-4 mb-4">
                <Select value={filterState} onValueChange={changeState}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600">
                        <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                        <SelectItem value="all">전체 상태</SelectItem>
                        <SelectItem value="approved">승인됨</SelectItem>
                        <SelectItem value="rejected">거절됨</SelectItem>
                        <SelectItem value="pending">대기중</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={changeRequestType}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600">
                        <SelectValue placeholder="요청 타입 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                        <SelectItem value="all">전체 타입</SelectItem>
                        <SelectItem value="add">추가 요청</SelectItem>
                        <SelectItem value="delete">삭제 요청</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    총 {totalCount}개 결과
                </div>
            </div>

            <div className="rounded-xl overflow-hidden shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-100 dark:bg-gray-900">
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="w-48">생성 시각</TableHead>
                            <TableHead className="w-[30%]">단어</TableHead>
                            <TableHead>요청자</TableHead>
                            <TableHead>처리자</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>요청 타입</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading || isPlaceholderData ? (
                            Array.from({ length: itemsPerPage }).map((_, index) => (
                                <TableRow key={index} data-testid="word-log-skeleton">
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton width={120} /></TableCell>
                                    <TableCell><Skeleton width={180} /></TableCell>
                                    <TableCell><Skeleton width={100} /></TableCell>
                                    <TableCell><Skeleton width={100} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                </TableRow>
                            ))
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    조건에 맞는 로그가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const isMyRequest = log.requesterId === user.uuid;
                                const localTime = new Date(log.createdAt).toLocaleString(undefined, {
                                    timeZone: userTimeZone,
                                });
                                const isWordLink = log.requestType === 'add'
                                    || (log.requestType === 'delete' && log.state === 'rejected');

                                return (
                                    <TableRow key={log.id} className={isMyRequest ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                                        <TableCell>{log.id}</TableCell>
                                        <TableCell>{localTime}</TableCell>
                                        <TableCell
                                            className={isWordLink
                                                ? "text-blue-600 underline hover:cursor-pointer dark:text-blue-400"
                                                : ""}
                                            onClick={() => {
                                                if (isWordLink) router.push(`/word/search/${log.word}`);
                                            }}
                                        >
                                            {log.word}
                                        </TableCell>
                                        <TableCell
                                            className={log.requesterNickname
                                                ? 'text-blue-600 underline hover:cursor-pointer dark:text-blue-400'
                                                : ''}
                                            onClick={() => {
                                                if (log.requesterNickname) {
                                                    router.push(`/profile/${log.requesterNickname}`);
                                                }
                                            }}
                                        >
                                            {log.requesterNickname || '-'}
                                        </TableCell>
                                        <TableCell
                                            className={log.processorNickname
                                                ? 'text-blue-600 underline hover:cursor-pointer dark:text-blue-400'
                                                : ''}
                                            onClick={() => {
                                                if (log.processorNickname) {
                                                    router.push(`/profile/${log.processorNickname}`);
                                                }
                                            }}
                                        >
                                            {log.processorNickname || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {log.state === 'approved' ? (
                                                <span className="text-green-600 dark:text-green-400 font-semibold">승인</span>
                                            ) : log.state === 'rejected' ? (
                                                <span className="text-red-600 dark:text-red-400 font-semibold">거절</span>
                                            ) : (
                                                <span className="text-yellow-600 dark:text-yellow-400 font-semibold">대기중</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {log.requestType === 'add' ? (
                                                <span className="text-blue-600 dark:text-blue-400">추가</span>
                                            ) : (
                                                <span className="text-orange-600 dark:text-orange-400">삭제</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-between items-center mt-6">
                <Button
                    variant="outline"
                    disabled={page === 1 || isFetching}
                    onClick={() => changePage(page - 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    이전
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-300">
                        {page} / {totalPages} 페이지
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                        ({((page - 1) * itemsPerPage) + 1}-{Math.min(page * itemsPerPage, totalCount)} / {totalCount})
                    </span>
                </div>

                <Button
                    variant="outline"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => changePage(page + 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    다음
                </Button>
            </div>
        </div>
    );
}
