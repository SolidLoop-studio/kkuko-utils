'use client'

import { useState, useEffect } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/src/app/components/ui/table"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/src/app/components/ui/pagination"
import { Checkbox } from "@/src/app/components/ui/checkbox"
import { Button } from "@/src/app/components/ui/button"
import { Badge } from "@/src/app/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/src/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/app/components/ui/tabs"
import ErrorModal from '../../components/ErrModal'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ThemeSelectModal from './ThemeSelectModal'
import {
    useWordRequestModeration,
    type ModerateWordRequestsCommand,
    type WordRequestModerationSelection,
} from '@/src/modules/word-moderation'
import type { ApplicationError } from '@/src/shared/application/application-error'

// 타입 정의
type Theme = {
    theme_id: number;
    theme_name: string;
    theme_code: string;
    typez?: "add" | "delete"; // 주제 추가/삭제 요청에서만 사용
}

type WordRequest = {
    request_key: string;
    id: number;
    word: string;
    request_type: "add" | "delete" | "theme_change";
    requested_at: string;
    requested_by_uuid?: string;
    requested_by: string;
    wait_themes?: Theme[];
    word_id?: number; // 주제 변경 요청에서만 사용
}

const createErrorMessage = (name: string, message: string): ErrorMessage => ({
    component: 'AdminRequestHome',
    ErrName: name,
    ErrMessage: message,
    ErrStackRace: null,
    inputValue: null,
});

const toPublicErrorMessage = (error: ApplicationError): ErrorMessage => {
    switch (error.kind) {
        case 'validation':
            return createErrorMessage('요청 확인', error.message);
        case 'conflict':
            return createErrorMessage('요청 충돌', '요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
        case 'unauthorized':
            return createErrorMessage('로그인 필요', '로그인이 필요합니다.');
        case 'forbidden':
            return createErrorMessage('권한 필요', '관리자 권한이 필요합니다.');
        case 'infrastructure':
        case 'not-found':
            return createErrorMessage('요청 처리 오류', '요청 단어 처리 중 오류가 발생했습니다.');
    }
};

const getThemeChangeType = (type: Theme['typez']): 'add' | 'delete' => {
    if (type === 'add' || type === 'delete') {
        return type;
    }

    // 잘못된 외부 입력도 누락하지 않고 Domain 검증까지 전달한다.
    return '' as 'add' | 'delete';
};

export default function AdminHome({ requestData: requestData, refreshFn }: { requestData: WordRequest[], refreshFn: () => Promise<void> }) {
    const [selectedTab, setSelectedTab] = useState<string>("all");
    const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
    const [selectedThemes, setSelectedThemes] = useState<Record<string, Set<number>>>({});
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [allSelected, setAllSelected] = useState<boolean>(false);
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);
    const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);
    const [selectedRequestForModal, setSelectedRequestForModal] = useState<WordRequest | null>(null);
    const [selectedThemeDetails, setSelectedThemeDetails] = useState<Record<string, Theme[]>>({});
    const {
        approve,
        reject,
        isPending,
        error,
        clearError,
    } = useWordRequestModeration();

    const PAGE_SIZE = 30;

    useEffect(() => {
        if (error) {
            setErrorModalView(toPublicErrorMessage(error));
        }
    }, [error]);

    // 요청 타입별 필터링
    const filteredRequests = requestData.filter(request => {
        if (selectedTab === "all") return true;
        return request.request_type === selectedTab;
    });

    // 페이지네이션 적용
    const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const currentRequests = filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);

    // 전체 선택 토글
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedRequests(new Set());
            setAllSelected(false);
        } else {
            const newSelected = new Set<string>();
            currentRequests.forEach(req => newSelected.add(req.request_key));
            setSelectedRequests(newSelected);
            setAllSelected(true);
        }
    };

    // 개별 요청 선택 토글
    const toggleRequest = (requestKey: string) => {
        const newSelected = new Set(selectedRequests);
        if (newSelected.has(requestKey)) {
            newSelected.delete(requestKey);
            setAllSelected(false);
        } else {
            newSelected.add(requestKey);
            if (newSelected.size === currentRequests.length) {
                setAllSelected(true);
            }
        }
        setSelectedRequests(newSelected);
    };

    // 주제 선택 버튼 클릭 핸들러
    const handleThemeSelectClick = (request: WordRequest) => {
        setSelectedRequestForModal(request);
        setThemeModalOpen(true);
    };

    // 모달에서 주제 선택 확인 핸들러
    const handleThemeModalConfirm = (selectedThemesList: Theme[]) => {
        if (!selectedRequestForModal) return;

        const newSelectedThemes = { ...selectedThemes };
        const themeIds = new Set(selectedThemesList.map(t => t.theme_id));
        newSelectedThemes[selectedRequestForModal.request_key] = themeIds;
        setSelectedThemes(newSelectedThemes);
        setSelectedThemeDetails({
            ...selectedThemeDetails,
            [selectedRequestForModal.request_key]: selectedThemesList,
        });

        // 주제가 선택되면 해당 요청도 자동으로 선택
        if (themeIds.size > 0) {
            const newSelected = new Set(selectedRequests);
            if (!newSelected.has(selectedRequestForModal.request_key)) {
                newSelected.add(selectedRequestForModal.request_key);
                if (newSelected.size === currentRequests.length) {
                    setAllSelected(true);
                }
                setSelectedRequests(newSelected);
            }
        }
    };

    const createModerationCommand = (): ModerateWordRequestsCommand => ({
        selections: [...selectedRequests].map((requestKey): WordRequestModerationSelection => {
            const request = requestData.find(item => item.request_key === requestKey);
            const selectedThemeIds = selectedThemes[requestKey] ?? new Set<number>();

            if (request?.request_type === 'theme_change') {
                const wordId = typeof request.word_id === 'number'
                    ? request.word_id
                    : Number.NaN;
                const changes = (request.wait_themes ?? [])
                    .filter(theme => selectedThemeIds.has(theme.theme_id))
                    .map(theme => ({
                        themeId: theme.theme_id,
                        type: getThemeChangeType(theme.typez),
                    }));

                return {
                    kind: 'theme-change',
                    wordId,
                    changes,
                };
            }

            return {
                kind: 'word-request',
                requestId: request?.id ?? Number.NaN,
                selectedThemeIds: [...selectedThemeIds],
            };
        }),
    });

    const processSelected = async (action: 'approve' | 'reject') => {
        if (isPending) return;

        clearError();
        setErrorModalView(null);

        if (selectedRequests.size === 0) {
            setErrorModalView(createErrorMessage('선택 오류', '선택된 요청이 없습니다.'));
            return;
        }

        const command = createModerationCommand();
        const actionResult = action === 'approve'
            ? await approve(command)
            : await reject(command);

        if (!actionResult.ok) {
            setErrorModalView(toPublicErrorMessage(actionResult.error));
            return;
        }

        setSelectedRequests(new Set());
        setSelectedThemes({});
        setSelectedThemeDetails({});
        setAllSelected(false);

        try {
            await refreshFn();
        } catch {
            setErrorModalView(createErrorMessage(
                '새로고침 오류',
                '요청 목록을 새로고침하는 중 오류가 발생했습니다.',
            ));
        }
    };

    const approveSelected = () => processSelected('approve');
    const rejectSelected = () => processSelected('reject');

    // 페이지 변경시 선택 상태 초기화
    useEffect(() => {
        setSelectedRequests(new Set());
        setSelectedThemes({});
        setSelectedThemeDetails({});
        setAllSelected(false);
    }, [currentPage, selectedTab]);

    // 날짜 포맷 함수
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const downloadRequestsTXT = () => {
        const lastUpdateDate = new Date();
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localTime = lastUpdateDate.toLocaleString(undefined, { timeZone: userTimeZone });

        const blob = new Blob([filteredRequests.map(req => req.word).join('\n')], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `요청목록(${localTime}).txt`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // 요청 타입 뱃지 렌더링
    const renderRequestTypeBadge = (type: string) => {
        switch (type) {
            case 'add':
                return <Badge className="bg-green-500">추가</Badge>;
            case 'delete':
                return <Badge className="bg-red-500">삭제</Badge>;
            case 'theme_change':
                return <Badge className="bg-blue-500">주제 변경</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
            {/* 관리자 대시보드로 이동 버튼 */}
            <div className="container mx-auto py-8">
                <Link href={'/admin'} className="mb-4 flex">
                    <Button variant="outline">
                        <ArrowLeft />
                        관리자 대시보드로 이동
                    </Button>
                </Link>
                <Card className="w-full bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-gray-100">단어 DB 관리자 페이지</CardTitle>
                        <CardDescription className="dark:text-gray-300">
                            단어 추가, 삭제 및 주제 변경 요청을 관리합니다.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <Tabs defaultValue="all" value={selectedTab} onValueChange={setSelectedTab}>
                            <TabsList className="mb-4">
                                <TabsTrigger value="all">전체 요청</TabsTrigger>
                                <TabsTrigger value="add">추가 요청</TabsTrigger>
                                <TabsTrigger value="delete">삭제 요청</TabsTrigger>
                                <TabsTrigger value="theme_change">주제 변경 요청</TabsTrigger>
                            </TabsList>

                            <TabsContent value={selectedTab}>
                                <div className="flex justify-end mb-4 gap-2">
                                    <Button
                                        variant="outline"
                                        className="bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800"
                                        onClick={approveSelected}
                                        disabled={isPending}
                                    >
                                        선택 승인
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800"
                                        onClick={rejectSelected}
                                        disabled={isPending}
                                    >
                                        선택 반려
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800"
                                        onClick={downloadRequestsTXT}
                                    >
                                        요청 리스트 다운로드 (TXT)
                                    </Button>
                                </div>

                                <div className="border rounded-md dark:border-gray-700">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12"> {/* 체크박스 */}
                                                    <Checkbox
                                                        checked={allSelected}
                                                        onCheckedChange={toggleSelectAll}
                                                        aria-label="전체 선택"
                                                    />
                                                </TableHead>
                                                <TableHead className="w-16 text-gray-700 dark:text-gray-200">No.</TableHead>
                                                <TableHead className="w-36 text-gray-700 dark:text-gray-200">단어</TableHead>
                                                <TableHead className="w-24 text-gray-700 dark:text-gray-200">요청 타입</TableHead>
                                                <TableHead className="w-48 text-gray-700 dark:text-gray-200">주제</TableHead>
                                                <TableHead className="w-40 text-gray-700 dark:text-gray-200">요청 시간</TableHead>
                                                <TableHead className="w-36 text-gray-700 dark:text-gray-200">요청자</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentRequests.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                                        요청이 없습니다.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentRequests.map((request) => (
                                                    <TableRow key={request.request_key} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedRequests.has(request.request_key)}
                                                                onCheckedChange={() => toggleRequest(request.request_key)}
                                                                aria-label={`${request.word} 선택`}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-gray-900 dark:text-gray-100">{request.id}</TableCell>
                                                        <TableCell className="text-gray-900 dark:text-gray-100">{request.word}</TableCell>
                                                        <TableCell>
                                                            {renderRequestTypeBadge(request.request_type)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {request.request_type === 'add' ? (
                                                                <div className="space-y-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleThemeSelectClick(request)}
                                                                        className="w-full"
                                                                    >
                                                                        주제 선택 ({selectedThemes[request.request_key]?.size || 0})
                                                                    </Button>
                                                                    {selectedThemes[request.request_key] && selectedThemes[request.request_key].size > 0 && (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {(selectedThemeDetails[request.request_key] ?? [])
                                                                                .filter(theme => selectedThemes[request.request_key]?.has(theme.theme_id))
                                                                                .map((theme, index) => (
                                                                                    <Badge key={`badge-${theme.theme_id}-${index}`} variant="secondary" className="text-xs">
                                                                                        {theme.theme_name}
                                                                                    </Badge>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : request.wait_themes ? (
                                                                <div className="flex flex-col gap-2">
                                                                    {request.wait_themes.map((theme, index) => (
                                                                        <div key={`t-${theme.theme_id}-${request.request_key}-${index ^ 10110}`} className="flex items-center gap-2">
                                                                            <Checkbox
                                                                                id={`theme-${request.request_key}-${theme.theme_id}`}
                                                                                checked={selectedThemes[request.request_key]?.has(theme.theme_id) || false}
                                                                                onCheckedChange={() => {
                                                                                    const currentThemes = selectedThemes[request.request_key] || new Set<number>();
                                                                                    const newSelectedThemes = { ...selectedThemes };
                                                                                    if (currentThemes.has(theme.theme_id)) {
                                                                                        currentThemes.delete(theme.theme_id);
                                                                                        if (currentThemes.size === 0) {
                                                                                            toggleRequest(request.request_key);
                                                                                        }
                                                                                    } else {
                                                                                        currentThemes.add(theme.theme_id);
                                                                                        const newSelected = new Set(selectedRequests);
                                                                                        if (!newSelected.has(request.request_key)) {
                                                                                            newSelected.add(request.request_key);
                                                                                            if (newSelected.size === currentRequests.length) {
                                                                                                setAllSelected(true);
                                                                                            }
                                                                                            setSelectedRequests(newSelected);
                                                                                        }
                                                                                    }
                                                                                    newSelectedThemes[request.request_key] = currentThemes;
                                                                                    setSelectedThemes(newSelectedThemes);
                                                                                }}
                                                                            />
                                                                            <label htmlFor={`theme-${request.request_key}-${theme.theme_id}`} className="text-sm flex items-center text-gray-700 dark:text-gray-200">
                                                                                {theme.theme_name}
                                                                                {theme.typez && (
                                                                                    <span className={`ml-1 text-xs px-1 rounded ${theme.typez === 'add' ? 'text-green-600 bg-green-50 dark:bg-green-900' : 'text-red-600 bg-red-50 dark:bg-red-900'
                                                                                        }`}>
                                                                                        {theme.typez === 'add' ? '추가' : '삭제'}
                                                                                    </span>
                                                                                )}
                                                                            </label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-500 dark:text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-gray-700 dark:text-gray-200">{request.requested_at !== "unknown" ? formatDate(request.requested_at) : "unknown"}</TableCell>
                                                        <TableCell className="text-gray-700 dark:text-gray-200">{request.requested_by}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
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
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>

                                    {/* 페이지네이션 렌더링 - 최대 5개 버튼 표시 */}
                                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                        let pageNum: number;

                                        if (totalPages <= 5) {
                                            // 5페이지 이하면 1부터 순차적으로
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            // 현재 페이지가 앞쪽이면 1~5 표시
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            // 현재 페이지가 뒤쪽이면 마지막 5개 표시
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            // 중간이면 현재 페이지 중심으로 표시
                                            pageNum = currentPage - 2 + i;
                                        }

                                        return (
                                            <PaginationItem key={`p-${pageNum}`}>
                                                <PaginationLink
                                                    isActive={currentPage === pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                >
                                                    {pageNum}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    })}

                                    <PaginationItem>
                                        <PaginationNext
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    </CardFooter>
                </Card>
                {errorModalView && <ErrorModal error={errorModalView} onClose={() => setErrorModalView(null)} />}
                {selectedRequestForModal && (
                    <ThemeSelectModal
                        isOpen={themeModalOpen}
                        onClose={() => {
                            setThemeModalOpen(false);
                            setSelectedRequestForModal(null);
                        }}
                        word={selectedRequestForModal.word}
                        initialSelectedThemes={selectedRequestForModal.wait_themes || []}
                        initialSelectedThemeIds={selectedThemes[selectedRequestForModal.request_key]}
                        onConfirm={handleThemeModalConfirm}
                    />
                )}
            </div>
        </div>
    )
}
