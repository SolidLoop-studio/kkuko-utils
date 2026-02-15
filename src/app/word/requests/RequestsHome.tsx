"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/app/components/ui/table";
import { Button } from "@/src/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/app/components/ui/select";
import { useSelector } from 'react-redux';
import { RootState } from "@/src/app/store/store";
import { useRouter } from 'next/navigation';
import { SCM } from '@/src/app/lib/supabaseClient';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import ErrorModal from "@/src/app/components/ErrModal";

interface RequestItem {
    id: number;
    request_type: "add" | "delete";
    requested_at: string;
    requested_by: string | null;
    status: "approved" | "rejected" | "pending";
    word: string;
    word_id: number | null;
    users: {nickname: string} | null
}

export default function RequestsPage() {
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);
    const user = useSelector((state: RootState) => state.user);
    const router = useRouter();

    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    useEffect(() => {
        const fetchRequests = async () => {
            setIsLoading(true);
            const { data, error } = await SCM.get().allWaitWords();

            if (error) {
                setErrorModalView({
                    ErrName: error.name,
                    ErrMessage: error.message,
                    ErrStackRace: error.stack,
                    inputValue: "/word/open-db-requests"
                });
                return;
            } else {
                setRequests(data);
            }
            setIsLoading(false);
        };

        fetchRequests();
    }, []);

    const itemsPerPage = 30;

    const filteredRequests = requests.filter((request) => {
        return filterStatus === "all" || request.status === filterStatus;
    });

    const startIdx = (page - 1) * itemsPerPage;
    const currentRequests = filteredRequests.slice(startIdx, startIdx + itemsPerPage);
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen text-gray-800 dark:text-gray-100 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
            {errorModalView && (
                <ErrorModal
                    error={errorModalView}
                    onClose={() => setErrorModalView(null)}
                />
            )}

            <h1 className="text-3xl font-bold mb-6">추가/삭제 요청</h1>

            <div className="flex gap-4 mb-4">
                <Select value={filterStatus} onValueChange={(v) => { setPage(1); setFilterStatus(v); }}>
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
                            Array.from({ length: itemsPerPage }).map((_, idx) => (
                                <TableRow key={idx}>
                                    <TableCell><Skeleton width={20} /></TableCell>
                                    <TableCell><Skeleton width={150} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                    <TableCell><Skeleton width={100} /></TableCell>
                                    <TableCell><Skeleton width={120} /></TableCell>
                                    <TableCell><Skeleton width={80} /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            currentRequests.map((req) => {
                                const isMyRequest = req.requested_by === user.uuid;
                                const localTime = new Date(req.requested_at).toLocaleString(undefined, { timeZone: userTimeZone });

                                return (
                                    <TableRow key={req.id} className={isMyRequest ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                                        <TableCell>{req.id}</TableCell>
                                        <TableCell
                                            className="text-blue-600 dark:text-blue-400 underline hover:cursor-pointer"
                                            onClick={() => router.push(`/word/search/${req.word}`)}
                                        >
                                            {req.word}
                                        </TableCell>
                                        <TableCell>
                                            {req.request_type === "add" ? (
                                                <span className="text-blue-600 dark:text-blue-400">추가</span>
                                            ) : (
                                                <span className="text-orange-600 dark:text-orange-400">삭제</span>
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className={req.requested_by ? "text-blue-600 dark:text-blue-400 underline hover:cursor-pointer" : ""}
                                            onClick={() => {
                                                if (req.users) {
                                                    router.push(`/profile/${req.users?.nickname}`)
                                                }
                                            }}
                                        >
                                            {req.users?.nickname || "-"}
                                        </TableCell>
                                        <TableCell>{localTime}</TableCell>
                                        <TableCell>
                                            {req.status === "approved" ? (
                                                <span className="text-green-600 dark:text-green-400 font-semibold">승인</span>
                                            ) : req.status === "rejected" ? (
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

            {/* 페이지네이션 */}
            <div className="flex justify-between items-center mt-6">
                <Button
                    variant="outline"
                    disabled={page === 1 || isLoading}
                    onClick={() => setPage((prev) => prev - 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    이전
                </Button>

                <span className="text-gray-600 dark:text-gray-300">
                    {page} / {totalPages} 페이지
                </span>

                <Button
                    variant="outline"
                    disabled={page === totalPages || isLoading}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    다음
                </Button>
            </div>
        </div>
    );

}
