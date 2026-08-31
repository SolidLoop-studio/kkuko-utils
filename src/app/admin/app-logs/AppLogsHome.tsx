'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import type { AppErrorLog, AppErrorSeverity } from '@/src/modules/admin-api-server';
import { deleteAppErrorLogs, fetchAppErrorLogs } from '@/src/modules/admin-api-server';
import { Badge } from '@/src/app/components/ui/badge';
import { Button } from '@/src/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/app/components/ui/card';
import { Checkbox } from '@/src/app/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/app/components/ui/table';
import CompleteModal from '@/src/app/components/CompleteModal';
import ConfirmModal from '@/src/app/components/ConfirmModal';
import FailModal from '@/src/app/components/FailModal';
import Spinner from '@/src/app/components/Spinner';
import AppLogDetailModal from './AppLogDetailModal';

type LimitOption = '50' | '100' | '500' | 'all';

const severityClassName: Record<AppErrorSeverity, string> = {
    INFO: 'bg-blue-600 hover:bg-blue-600',
    WARN: 'bg-amber-500 hover:bg-amber-500',
    ERROR: 'bg-red-600 hover:bg-red-600',
    FATAL: 'bg-purple-700 hover:bg-purple-700',
};

const toLimit = (value: LimitOption): number | undefined => value === 'all' ? undefined : Number(value);

const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '알 수 없는 시각';
    return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
};

export default function AppLogsHome() {
    const [limit, setLimit] = useState<LimitOption>('100');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedLog, setSelectedLog] = useState<AppErrorLog | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isQueryErrorDismissed, setIsQueryErrorDismissed] = useState(false);
    const [failureMessage, setFailureMessage] = useState<string | null>(null);
    const [deletedCount, setDeletedCount] = useState<number | null>(null);
    const isDeletingRef = useRef(false);
    const queryClient = useQueryClient();
    const queryKey = ['admin', 'app-error-logs', limit] as const;

    const query = useQuery({
        queryKey,
        queryFn: () => fetchAppErrorLogs(toLimit(limit)),
    });
    const deleteMutation = useMutation({ mutationFn: deleteAppErrorLogs });
    const logs = query.data ?? [];
    const isAllSelected = logs.length > 0 && logs.every((log) => selectedIds.has(log.id));
    const isPartiallySelected = selectedIds.size > 0 && !isAllSelected;

    useEffect(() => {
        if (!query.data) return;
        const visibleIds = new Set(query.data.map((log) => log.id));
        setSelectedIds((current) => {
            const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [query.data]);

    const toggleAll = () => {
        setSelectedIds(isAllSelected ? new Set() : new Set(logs.map((log) => log.id)));
    };

    const toggleOne = (id: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const confirmDelete = async () => {
        if (isDeletingRef.current) return;
        const ids = logs.filter((log) => selectedIds.has(log.id)).map((log) => log.id);
        if (ids.length === 0) return;
        isDeletingRef.current = true;
        try {
            const result = await deleteMutation.mutateAsync(ids);
            setIsConfirmOpen(false);
            setSelectedIds(new Set());
            queryClient.setQueryData<AppErrorLog[]>(queryKey, (current) => (
                current?.filter((log) => !ids.includes(log.id)) ?? []
            ));
            setIsQueryErrorDismissed(true);
            setDeletedCount(result.deletedCount);
            void query.refetch();
        } catch {
            setIsConfirmOpen(false);
            setFailureMessage('선택한 애플리케이션 로그를 삭제하는 중 오류가 발생했습니다.');
        } finally {
            isDeletingRef.current = false;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
            <div className="container mx-auto max-w-7xl space-y-6">
                <Button asChild variant="outline">
                    <Link href="/admin" className="flex w-fit">
                        <ArrowLeft className="mr-2 h-4 w-4" />관리자 대시보드로 이동
                    </Link>
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>애플리케이션 에러 로그</CardTitle>
                        <CardDescription>사용자가 보고한 애플리케이션 오류를 조회하고 관리합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <label className="flex flex-col gap-1 text-sm font-medium">
                                조회 개수
                                <select
                                    aria-label="조회 개수"
                                    value={limit}
                                    onChange={(event) => {
                                        setLimit(event.target.value as LimitOption);
                                        setSelectedIds(new Set());
                                        setIsQueryErrorDismissed(false);
                                    }}
                                    className="h-9 rounded-md border bg-white px-3 dark:bg-gray-800"
                                >
                                    <option value="50">50개</option>
                                    <option value="100">100개</option>
                                    <option value="500">500개</option>
                                    <option value="all">전체</option>
                                </select>
                            </label>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsQueryErrorDismissed(false);
                                        void query.refetch();
                                    }}
                                    disabled={query.isFetching}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />새로고침
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setIsConfirmOpen(true)}
                                    disabled={selectedIds.size === 0 || deleteMutation.isPending}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />선택 로그 삭제 ({selectedIds.size})
                                </Button>
                            </div>
                        </div>

                        {query.isLoading ? (
                            <div className="flex h-48 items-center justify-center"><Spinner /></div>
                        ) : logs.length === 0 ? (
                            <p className="py-12 text-center text-gray-500">조회된 애플리케이션 로그가 없습니다.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    aria-label="모든 로그 선택"
                                                    checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                                                    onCheckedChange={toggleAll}
                                                />
                                            </TableHead>
                                            <TableHead>발생 시각</TableHead>
                                            <TableHead>심각도</TableHead>
                                            <TableHead>메시지</TableHead>
                                            <TableHead>URL</TableHead>
                                            <TableHead>컴포넌트</TableHead>
                                            <TableHead>사용자 ID</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        aria-label={`${log.message} (${log.id}) 선택`}
                                                        checked={selectedIds.has(log.id)}
                                                        onCheckedChange={() => toggleOne(log.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                                                <TableCell><Badge className={severityClassName[log.severity]}>{log.severity}</Badge></TableCell>
                                                <TableCell className="min-w-64 max-w-md">
                                                    <button
                                                        type="button"
                                                        aria-label={`${log.message} 상세 보기`}
                                                        onClick={() => setSelectedLog(log)}
                                                        className="block w-full truncate text-left font-medium hover:underline"
                                                    >
                                                        {log.message}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="max-w-48 truncate">{log.url ?? '—'}</TableCell>
                                                <TableCell>{log.component ?? '—'}</TableCell>
                                                <TableCell>{log.userId ?? '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <AppLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
            <ConfirmModal
                open={isConfirmOpen}
                title="선택한 로그를 삭제하시겠습니까?"
                description={`${selectedIds.size}개의 로그가 영구적으로 삭제됩니다.`}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={() => { void confirmDelete(); }}
                isPending={deleteMutation.isPending}
            />
            <CompleteModal
                open={deletedCount !== null}
                title="로그 삭제 완료"
                description={`${deletedCount ?? 0}개의 애플리케이션 로그를 삭제했습니다.`}
                onClose={() => setDeletedCount(null)}
            />
            <FailModal
                open={(query.isError && !isQueryErrorDismissed) || failureMessage !== null}
                title="애플리케이션 로그 작업 오류"
                description={failureMessage ?? '애플리케이션 로그를 불러오는 중 오류가 발생했습니다.'}
                onClose={() => {
                    setFailureMessage(null);
                    setIsQueryErrorDismissed(true);
                }}
            />
        </div>
    );
}
