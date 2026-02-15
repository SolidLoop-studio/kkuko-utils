"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/app/components/ui/table";
import { Button } from "@/src/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/app/components/ui/select";
import { ArrowLeft } from "lucide-react";

interface DocsLogsProps {
    id: number;
    name: string;
    Logs: {
        id: number;
        word: string;
        user: string | undefined;
        date: string;
        type: "add" | "delete";
    }[];
}

const DocsLogs = ({ id, name, Logs }: DocsLogsProps) => {
    const [page, setPage] = useState(1);
    const [filterType, setFilterType] = useState<string>("all");
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const convertToLocalTime = (date: string) => {
        const dateObj = new Date(date);
        return dateObj.toLocaleString(undefined, { timeZone: userTimeZone });
    };

    // 페이지네이션 설정
    const itemsPerPage = 30;
    
    // 필터링 적용
    const filteredLogs = Logs.filter((log) => {
        return filterType === "all" || log.type === filterType;
    });
    
    const startIdx = (page - 1) * itemsPerPage;
    const currentLogs = filteredLogs.slice(startIdx, startIdx + itemsPerPage);
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    return (
        <div className="p-6 max-w-6xl mx-auto bg-gray-50 dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-800 min-h-screen text-gray-800 dark:text-gray-100">
            <Link href={`/words-docs/${id}`} className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                <ArrowLeft size={18} className="mr-2" />
                <span>문서로 돌아가기</span>
            </Link>

            {/* 문서 제목 섹션 */}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3 mt-3">
                {name} - 로그
            </h1>

            {/* 필터링 섹션 */}
            <div className="flex gap-4 mb-4">
                <Select value={filterType} onValueChange={(v) => { setPage(1); setFilterType(v); }}>
                    <SelectTrigger className="w-[160px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600">
                        <SelectValue placeholder="요청 타입 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                        <SelectItem value="all">전체 타입</SelectItem>
                        <SelectItem value="add">추가 요청</SelectItem>
                        <SelectItem value="delete">삭제 요청</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 로그 테이블 */}
            <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-100 dark:bg-gray-900">
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="w-48">생성 시각</TableHead>
                            <TableHead>단어</TableHead>
                            <TableHead>사용자</TableHead>
                            <TableHead>요청 타입</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    조건에 맞는 로그가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.id}</TableCell>
                                    <TableCell>{convertToLocalTime(log.date)}</TableCell>
                                    <TableCell>
                                        {log.type === "add" ? (
                                            <Link
                                                href={`/word/search/${log.word}`}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {log.word}
                                            </Link>
                                        ) : (
                                            log.word
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {log.user ? (
                                            <Link
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                                href={`/profile/${log.user}`}
                                            >
                                                {log.user}
                                            </Link>
                                        ) : (
                                            "알수없음"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {log.type === "add" ? (
                                            <span className="text-blue-600 dark:text-blue-400">추가</span>
                                        ) : (
                                            <span className="text-orange-600 dark:text-orange-400">삭제</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 페이지네이션 */}
            <div className="flex justify-between items-center mt-6">
                <Button
                    variant="outline"
                    disabled={page === 1}
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
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-blue-300 dark:hover:border-blue-600"
                >
                    다음
                </Button>
            </div>
        </div>
    );
};

export default DocsLogs;