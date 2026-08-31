"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/app/components/ui/table";
import { Button } from "@/src/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/app/components/ui/select";
import { useSelector } from 'react-redux';
import { RootState } from "@/src/app/store/store";
import { useRouter } from 'next/navigation';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import ErrorModal from "@/src/app/components/ErrModal";
import {
    type PublicWordRequestStatus,
    usePublicWordRequestPage,
} from "@/src/modules/word-requests";

const pageSize = 30;

const errorModal = {
    component: 'RequestsHome',
    ErrName: 'ApplicationError',
    ErrMessage: '단어 요청 목록을 불러오는 중 오류가 발생했습니다.',
    ErrStackRace: '',
    inputValue: '/word/requests',
};

export default function RequestsHome() {
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState<PublicWordRequestStatus>('all');
    const [isErrorModalDismissed, setIsErrorModalDismissed] = useState(false);
    const { data, error, isLoading } = usePublicWordRequestPage({ page, status: filterStatus });
    const user = useSelector((state: RootState) => state.user);
    const router = useRouter();
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const totalCount = data?.totalCount ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const displayPage = totalPages === 0 ? 0 : page;

    useEffect(() => {
        if (error) setIsErrorModalDismissed(false);
    }, [error]);

    useEffect(() => {
        if (totalPages > 0 && page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen text-gray-800 dark:text-gray-100 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
            {error && !isErrorModalDismissed && (
                <ErrorModal
                    error={errorModal}
                    onClose={() => setIsErrorModalDismissed(true)}
                />
            )}

            <h1 className="text-3xl font-bold mb-6">추가/삭제 요청</h1>

            <div className="flex gap-4 mb-4">
                <Select value={filterStatus} onValueChange={(value) => {
                    setPage(1);
                    setFilterStatus(value as PublicWordRequestStatus);
                }}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600">
                        <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                        <SelectItem value="all">전체 상태</SelectItem>
                        <SelectItem value="pending">대기중</SelectItem>
                        <SelectItem value="approved">승인됨</SelectItem>
                        <SelectItem value="rejected">거절됨</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-xl overflow-hidden shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-100 dark:bg-gray-900">
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead>요청 단어</TableHead>
                            <TableHead>요청 타입</TableHead>
                            <TableHead>요청자</TableHead>
                            <TableHead>요청 시간</TableHead>
                            <TableHead>상태</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array(pageSize).fill(null).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton width={20} /></TableCell>
                                    <TableCell><Skeleton width={150} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                    <TableCell><Skeleton width={100} /></TableCell>
                                    <TableCell><Skeleton width={120} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            data?.items.map((request) => {
                                const isMyRequest = request.requestedBy === user.uuid;
                                const localTime = new Date(request.requestedAt).toLocaleString(undefined, { timeZone: userTimeZone });

                                return (
                                    <TableRow key={request.id} className={isMyRequest ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                                        <TableCell>{request.id}</TableCell>
                                        <TableCell
                                            className="text-blue-600 dark:text-blue-400 underline hover:cursor-pointer"
                                            onClick={() => router.push(`/word/search/${request.word}`)}
                                        >
                                            {request.word}
                                        </TableCell>
                                        <TableCell>
                                            {request.requestType === "add" ? (
                                                <span className="text-blue-600 dark:text-blue-400">추가</span>
                                            ) : (
                                                <span className="text-orange-600 dark:text-orange-400">삭제</span>
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className={request.requesterNickname ? "text-blue-600 dark:text-blue-400 underline hover:cursor-pointer" : ""}
                                            onClick={() => {
                                                if (request.requesterNickname) {
                                                    router.push(`/profile/${request.requesterNickname}`);
                                                }
                                            }}
                                        >
                                            {request.requesterNickname || "-"}
                                        </TableCell>
                                        <TableCell>{localTime}</TableCell>
                                        <TableCell>
                                            {request.status === "approved" ? (
                                                <span className="text-green-600 dark:text-green-400 font-semibold">승인</span>
                                            ) : request.status === "rejected" ? (
                                                <span className="text-red-600 dark:text-red-400 font-semibold">거절</span>
                                            ) : (
                                                <span className="text-yellow-600 dark:text-yellow-400 font-semibold">대기중</span>
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
                    disabled={page <= 1 || totalPages === 0 || isLoading}
                    onClick={() => setPage((previous) => previous - 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    이전
                </Button>

                <span className="text-gray-600 dark:text-gray-300">
                    {displayPage} / {totalPages} 페이지
                </span>

                <Button
                    variant="outline"
                    disabled={totalPages === 0 || page >= totalPages || isLoading}
                    onClick={() => setPage((previous) => previous + 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    다음
                </Button>
            </div>
        </div>
    );
}
