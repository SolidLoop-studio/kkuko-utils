'use client'

import { useState } from 'react';
import Link from 'next/link';
import type {
    AdminDocsLogEntry,
    AdminLogsPageQuery,
    AdminWordLogEntry,
} from '@/src/modules/admin-logs';
import { useAdminLogsPage, useDeleteAdminLogs } from '@/src/modules/admin-logs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/app/components/ui/card';
import { Button } from '@/src/app/components/ui/button';
import { Badge } from '@/src/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/app/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/app/components/ui/table';
import { Checkbox } from '@/src/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/app/components/ui/select';
import { Input } from '@/src/app/components/ui/input';
import { Label } from '@/src/app/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/src/app/components/ui/pagination';
import { ArrowLeft, Filter, Trash2 } from 'lucide-react';
import ErrorModal from '@/src/app/components/ErrModal';

type ErrorMessage = {
    ErrName: string;
    ErrMessage: string;
    ErrStackRace: string;
    inputValue: string;
};

type Docs = {
    id: number;
    name: string;
    typez: 'letter' | 'theme' | 'ect';
};

interface AdminLogsHomeProps {
    allDocs: Docs[];
}

type AdminLogsTab = 'word_logs' | 'docs_logs';

const stableDeleteError = (): ErrorMessage => ({
    ErrName: '관리자 로그 삭제 오류',
    ErrMessage: '선택한 로그를 삭제하는 중 오류가 발생했습니다.',
    ErrStackRace: '',
    inputValue: '',
});

const noSelectionError = (): ErrorMessage => ({
    ErrName: '관리자 로그 삭제 오류',
    ErrMessage: '선택된 로그가 없습니다.',
    ErrStackRace: '',
    inputValue: '',
});

const toIsoDate = (value: string): string | undefined => (
    value === '' ? undefined : new Date(value).toISOString()
);

export default function AdminLogsHome({ allDocs }: AdminLogsHomeProps) {
    const [selectedTab, setSelectedTab] = useState<AdminLogsTab>('word_logs');
    const [selectedWordLogs, setSelectedWordLogs] = useState<Set<number>>(new Set());
    const [selectedDocsLogs, setSelectedDocsLogs] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [allSelected, setAllSelected] = useState(false);
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);
    const [isQueryErrorDismissed, setIsQueryErrorDismissed] = useState(false);

    const [wordLogState, setWordLogState] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
    const [wordLogType, setWordLogType] = useState<'all' | 'add' | 'delete'>('all');
    const [docsLogType, setDocsLogType] = useState<'all' | 'add' | 'delete'>('all');
    const [selectedDocsName, setSelectedDocsName] = useState('all');
    const [dateFromFilter, setDateFromFilter] = useState('');
    const [dateToFilter, setDateToFilter] = useState('');

    const isDateFilterApplied = dateFromFilter !== '' || dateToFilter !== '';
    const pageSize = isDateFilterApplied ? 150 : 30;
    const query: AdminLogsPageQuery = {
        page: currentPage,
        pageSize,
        ...(toIsoDate(dateFromFilter) === undefined
            ? {}
            : { fromDate: toIsoDate(dateFromFilter) }),
        ...(toIsoDate(dateToFilter) === undefined
            ? {}
            : { toDate: toIsoDate(dateToFilter) }),
        filter: selectedTab === 'word_logs'
            ? { kind: 'word', state: wordLogState, requestType: wordLogType }
            : {
                kind: 'docs',
                ...(selectedDocsName === 'all' ? {} : { documentName: selectedDocsName }),
                type: docsLogType,
            },
    };
    const { data, error, isFetching, refetch } = useAdminLogsPage(query);
    const { deleteAdminLogs, isPending: isDeletePending } = useDeleteAdminLogs();
    const currentPageLogs = data?.items ?? [];
    const totalCount = data?.totalCount ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const clearSelection = () => {
        setSelectedWordLogs(new Set());
        setSelectedDocsLogs(new Set());
        setAllSelected(false);
    };

    const resetQueryWindow = () => {
        clearSelection();
        setIsQueryErrorDismissed(false);
        setCurrentPage(1);
    };

    const changePage = (page: number) => {
        if (page < 1 || page > totalPages || page === currentPage) return;
        clearSelection();
        setIsQueryErrorDismissed(false);
        setCurrentPage(page);
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            clearSelection();
            return;
        }

        const selected = new Set(currentPageLogs.map((log) => log.id));
        if (selectedTab === 'word_logs') {
            setSelectedWordLogs(selected);
        } else {
            setSelectedDocsLogs(selected);
        }
        setAllSelected(true);
    };

    const toggleLog = (id: number) => {
        const selectedLogs = selectedTab === 'word_logs' ? selectedWordLogs : selectedDocsLogs;
        const nextSelected = new Set(selectedLogs);
        if (nextSelected.has(id)) {
            nextSelected.delete(id);
            setAllSelected(false);
        } else {
            nextSelected.add(id);
            setAllSelected(nextSelected.size === currentPageLogs.length);
        }

        if (selectedTab === 'word_logs') {
            setSelectedWordLogs(nextSelected);
        } else {
            setSelectedDocsLogs(nextSelected);
        }
    };

    const deleteSelectedLogs = async () => {
        const selectedLogs = selectedTab === 'word_logs'
            ? selectedWordLogs
            : selectedDocsLogs;
        if (selectedLogs.size === 0) {
            setErrorModalView(noSelectionError());
            return;
        }

        const result = await deleteAdminLogs({
            kind: selectedTab === 'word_logs' ? 'word' : 'docs',
            ids: Array.from(selectedLogs),
        });
        if (!result.ok) {
            setErrorModalView(stableDeleteError());
            return;
        }

        clearSelection();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const renderStateBadge = (state: string) => {
        switch (state) {
            case 'approved':
                return <Badge className="bg-green-500">승인</Badge>;
            case 'rejected':
                return <Badge className="bg-red-500">거절</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500">대기</Badge>;
            default:
                return <Badge className="bg-gray-500">{state}</Badge>;
        }
    };

    const renderTypeBadge = (type: string) => {
        switch (type) {
            case 'add':
                return <Badge className="bg-blue-500">추가</Badge>;
            case 'delete':
                return <Badge className="bg-red-500">삭제</Badge>;
            default:
                return <Badge className="bg-gray-500">{type}</Badge>;
        }
    };

    const themeDocs = allDocs.filter((docs) => docs.typez === 'theme');
    const queryError = error === null || isQueryErrorDismissed
        ? null
        : {
            ErrName: '관리자 로그 조회 오류',
            ErrMessage: error.message,
            ErrStackRace: '',
            inputValue: '',
        };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto py-8">
                <Link href="/admin" className="mb-4 flex">
                    <Button variant="outline">
                        <ArrowLeft />
                        관리자 대시보드로 이동
                    </Button>
                </Link>

                <Card className="w-full bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-gray-100">로그 관리 페이지</CardTitle>
                        <CardDescription className="dark:text-gray-300">
                            단어 로그와 문서 로그를 관리합니다.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <Tabs
                            value={selectedTab}
                            onValueChange={(value) => {
                                setSelectedTab(value as AdminLogsTab);
                                resetQueryWindow();
                            }}
                        >
                            <TabsList className="mb-4">
                                <TabsTrigger value="word_logs">단어 로그</TabsTrigger>
                                <TabsTrigger value="docs_logs">문서 로그</TabsTrigger>
                            </TabsList>

                            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {selectedTab === 'word_logs' ? (
                                        <>
                                            <div>
                                                <Label htmlFor="state-filter">상태</Label>
                                                <Select
                                                    value={wordLogState}
                                                    onValueChange={(value: 'all' | 'approved' | 'rejected' | 'pending') => {
                                                        setWordLogState(value);
                                                        resetQueryWindow();
                                                    }}
                                                >
                                                    <SelectTrigger id="state-filter">
                                                        <SelectValue placeholder="상태 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">전체</SelectItem>
                                                        <SelectItem value="approved">승인</SelectItem>
                                                        <SelectItem value="rejected">거절</SelectItem>
                                                        <SelectItem value="pending">대기</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="type-filter">타입</Label>
                                                <Select
                                                    value={wordLogType}
                                                    onValueChange={(value: 'all' | 'add' | 'delete') => {
                                                        setWordLogType(value);
                                                        resetQueryWindow();
                                                    }}
                                                >
                                                    <SelectTrigger id="type-filter">
                                                        <SelectValue placeholder="타입 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">전체</SelectItem>
                                                        <SelectItem value="add">추가</SelectItem>
                                                        <SelectItem value="delete">삭제</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <Label htmlFor="docs-filter">문서</Label>
                                                <Select
                                                    value={selectedDocsName}
                                                    onValueChange={(value) => {
                                                        setSelectedDocsName(value);
                                                        resetQueryWindow();
                                                    }}
                                                >
                                                    <SelectTrigger id="docs-filter">
                                                        <SelectValue placeholder="문서 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">전체</SelectItem>
                                                        {themeDocs.map((docs) => (
                                                            <SelectItem key={docs.id} value={docs.name}>
                                                                {docs.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="docs-type-filter">타입</Label>
                                                <Select
                                                    value={docsLogType}
                                                    onValueChange={(value: 'all' | 'add' | 'delete') => {
                                                        setDocsLogType(value);
                                                        resetQueryWindow();
                                                    }}
                                                >
                                                    <SelectTrigger id="docs-type-filter">
                                                        <SelectValue placeholder="타입 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">전체</SelectItem>
                                                        <SelectItem value="add">추가</SelectItem>
                                                        <SelectItem value="delete">삭제</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <Label htmlFor="date-from-filter">시작 날짜+시간</Label>
                                        <Input
                                            id="date-from-filter"
                                            type="datetime-local"
                                            value={dateFromFilter}
                                            onChange={(event) => {
                                                setDateFromFilter(event.target.value);
                                                resetQueryWindow();
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="date-to-filter">종료 날짜+시간</Label>
                                        <Input
                                            id="date-to-filter"
                                            type="datetime-local"
                                            value={dateToFilter}
                                            onChange={(event) => {
                                                setDateToFilter(event.target.value);
                                                resetQueryWindow();
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <Button
                                            onClick={() => {
                                                setIsQueryErrorDismissed(false);
                                                void refetch();
                                            }}
                                            disabled={isFetching}
                                            className="flex-1"
                                        >
                                            <Filter className="w-4 h-4 mr-2" />
                                            {isFetching ? '로딩...' : '필터 적용'}
                                        </Button>
                                        {isDateFilterApplied && (
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setDateFromFilter('');
                                                    setDateToFilter('');
                                                    resetQueryWindow();
                                                }}
                                                className="px-3"
                                                title="날짜 필터 초기화"
                                            >
                                                ✕
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {isDateFilterApplied && (
                                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            📅 날짜 필터가 적용되어 페이지당 {pageSize}개씩 표시됩니다.
                                            {dateFromFilter && ` 시작: ${new Date(dateFromFilter).toLocaleString('ko-KR')}`}
                                            {dateToFilter && ` 종료: ${new Date(dateToFilter).toLocaleString('ko-KR')}`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <TabsContent value={selectedTab}>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        전체 {totalCount}개 중 {totalCount}개 표시
                                        {` (페이지당 ${pageSize}개)`}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800"
                                            onClick={() => void deleteSelectedLogs()}
                                            disabled={isDeletePending}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            {isDeletePending ? '삭제 중...' : '선택 삭제'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="border rounded-md dark:border-gray-700">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">
                                                    <Checkbox
                                                        checked={allSelected}
                                                        onCheckedChange={toggleSelectAll}
                                                        aria-label="전체 선택"
                                                    />
                                                </TableHead>
                                                <TableHead className="w-16 text-gray-700 dark:text-gray-200">ID</TableHead>
                                                <TableHead className="w-36 text-gray-700 dark:text-gray-200">단어</TableHead>
                                                {selectedTab === 'word_logs' ? (
                                                    <>
                                                        <TableHead className="w-24 text-gray-700 dark:text-gray-200">상태</TableHead>
                                                        <TableHead className="w-24 text-gray-700 dark:text-gray-200">타입</TableHead>
                                                        <TableHead className="w-36 text-gray-700 dark:text-gray-200">요청자</TableHead>
                                                        <TableHead className="w-36 text-gray-700 dark:text-gray-200">처리자</TableHead>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableHead className="w-36 text-gray-700 dark:text-gray-200">문서명</TableHead>
                                                        <TableHead className="w-24 text-gray-700 dark:text-gray-200">타입</TableHead>
                                                        <TableHead className="w-36 text-gray-700 dark:text-gray-200">처리자</TableHead>
                                                    </>
                                                )}
                                                <TableHead className="w-40 text-gray-700 dark:text-gray-200">처리 시간</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentPageLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={selectedTab === 'word_logs' ? 8 : 7} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                                        로그가 없습니다.
                                                    </TableCell>
                                                </TableRow>
                                            ) : currentPageLogs.map((log) => (
                                                <TableRow key={`${selectedTab}-${log.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedTab === 'word_logs'
                                                                ? selectedWordLogs.has(log.id)
                                                                : selectedDocsLogs.has(log.id)}
                                                            onCheckedChange={() => toggleLog(log.id)}
                                                            aria-label={`로그 ${log.id} 선택`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-gray-900 dark:text-gray-100">{log.id}</TableCell>
                                                    <TableCell className="text-gray-900 dark:text-gray-100">{log.word}</TableCell>
                                                    {selectedTab === 'word_logs' ? (
                                                        <>
                                                            <TableCell>{renderStateBadge((log as AdminWordLogEntry).state)}</TableCell>
                                                            <TableCell>{renderTypeBadge((log as AdminWordLogEntry).requestType)}</TableCell>
                                                            <TableCell className="text-gray-900 dark:text-gray-100">
                                                                {(log as AdminWordLogEntry).requesterNickname || 'N/A'}
                                                            </TableCell>
                                                            <TableCell className="text-gray-900 dark:text-gray-100">
                                                                {(log as AdminWordLogEntry).processorNickname || 'N/A'}
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableCell className="text-gray-900 dark:text-gray-100">
                                                                {(log as AdminDocsLogEntry).documentName ?? 'N/A'}
                                                            </TableCell>
                                                            <TableCell>{renderTypeBadge((log as AdminDocsLogEntry).type)}</TableCell>
                                                            <TableCell className="text-gray-900 dark:text-gray-100">
                                                                {(log as AdminDocsLogEntry).actorNickname || 'N/A'}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="text-gray-900 dark:text-gray-100">
                                                        {formatDate(selectedTab === 'word_logs'
                                                            ? (log as AdminWordLogEntry).createdAt
                                                            : (log as AdminDocsLogEntry).occurredAt)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>

                    <CardFooter>
                        <div className="w-full">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                changePage(currentPage - 1);
                                            }}
                                            aria-disabled={currentPage <= 1}
                                            tabIndex={currentPage <= 1 ? -1 : 0}
                                            className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                        />
                                    </PaginationItem>

                                    {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                                        let pageNumber: number;
                                        if (totalPages <= 5 || currentPage <= 3) {
                                            pageNumber = index + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNumber = totalPages - 4 + index;
                                        } else {
                                            pageNumber = currentPage - 2 + index;
                                        }

                                        return (
                                            <PaginationItem key={`p-${pageNumber}`}>
                                                <PaginationLink
                                                    href="#"
                                                    isActive={currentPage === pageNumber}
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        changePage(pageNumber);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    {pageNumber}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    })}

                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                changePage(currentPage + 1);
                                            }}
                                            aria-disabled={totalPages === 0 || currentPage >= totalPages}
                                            tabIndex={totalPages === 0 || currentPage >= totalPages ? -1 : 0}
                                            className={totalPages === 0 || currentPage >= totalPages
                                                ? 'pointer-events-none opacity-50'
                                                : 'cursor-pointer'}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    </CardFooter>
                </Card>

                {(errorModalView ?? queryError) && (
                    <ErrorModal
                        error={(errorModalView ?? queryError) as ErrorMessage}
                        onClose={() => {
                            if (errorModalView !== null) {
                                setErrorModalView(null);
                            } else {
                                setIsQueryErrorDismissed(true);
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
}
