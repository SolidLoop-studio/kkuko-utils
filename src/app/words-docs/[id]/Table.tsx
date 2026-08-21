"use client";
import { useState, lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { useReactTable, getCoreRowModel, getSortedRowModel, ColumnDef, SortingState } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useSelector } from 'react-redux';
import { RootState } from "@/src/app/store/store";
import ErrorModal from "@/src/app/components/ErrModal";
import type { ErrorMessage } from "@/src/app/types/type";
import Spinner from "@/src/app/components/Spinner";
import CompleteModal from "@/src/app/components/CompleteModal";
import Link from "next/link";
import { memo } from "react";
import { useDocsWordModeration } from "@/src/modules/word-moderation";
import type { ApplicationError } from "@/src/shared/application/application-error";
import type { DocsWordMutationTarget } from "@/src/modules/word-moderation";
import { useUserWordRequestActions } from "./use-user-word-request-actions";
import type { DocsWordAdminAction, DocsWordData } from "./docs-word-data";

const WorkModal = lazy(() => import("./WorkModal"));

type RequestModerationTarget = Exclude<DocsWordMutationTarget, { kind: "registered-word" }>;
type UserWordRequestError = Parameters<Parameters<typeof useUserWordRequestActions>[0]["makeError"]>[0];

const isRequestTargetForRow = (
    row: DocsWordData,
): row is DocsWordData & { mutationTarget: RequestModerationTarget } => {
    const target = row.mutationTarget;
    if (target?.kind === "word-request") return target.requestType === row.status;
    if (target?.kind === "theme-change") return target.type === row.status;
    return false;
};

const getAdminErrorMessage = (error: ApplicationError) => {
    switch (error.kind) {
        case "validation":
            return error.message;
        case "conflict":
            return "요청 목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.";
        case "unauthorized":
            return "로그인이 필요합니다.";
        case "forbidden":
            return "관리자 권한이 필요합니다.";
        case "not-found":
        case "infrastructure":
            return "문서 단어 처리 중 오류가 발생했습니다.";
    }
};

const Table = ({ 
    initialData, 
    isMission = { m: false, t: null }, // m: 미션여부, t: 미션 글자
    isLong = false,
    onAdminActionComplete,
}: {
    initialData: DocsWordData[],
    isMission?: { m: false, t: null } | { m: true, t: string } 
    isLong?: boolean,
    onAdminActionComplete(action: DocsWordAdminAction, row: DocsWordData): Promise<boolean>,
}) => {
    const data = initialData;
    
    // isMission.m이 true일 때는 포함개수 기준 내림차순으로 기본 정렬
    const [sorting, setSorting] = useState<SortingState>(
        isMission.m ? [{ id: "count", desc: true }] : isLong ? [{ id: "length", desc: true }] : []
    );
    
    const [modal, setModal] = useState<DocsWordData | null>(null);
    
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isAdminTransitionPending, setIsAdminTransitionPending] = useState(false);
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const user = useSelector((state: RootState) => state.user);

    // 특정 문자 포함 개수를 계산하는 함수
    const getCharCount = useCallback((word: string, char: string): number => {
        if (!char) return 0;
        return (word.match(new RegExp(char, 'g')) || []).length;
    }, []);

    const columns: ColumnDef<DocsWordData>[] = useMemo(() => [
        {
            accessorFn: (row) => 
                isMission.m && isMission.t 
                    ? getCharCount(row.word, isMission.t)
                    : row.word.length,
            id: isMission.m ? "count" : "length",
            header: ({ column }) => {
                const isSorted = column.getIsSorted();
                return (
                    <button
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        {isMission.m ? `포함수` : "길이"}
                        {isSorted === "desc" ? (
                            <ArrowDown className="h-4 w-4" />
                        ) : isSorted === "asc" ? (
                            <ArrowUp className="h-4 w-4" />
                        ) : (
                            <ArrowUpDown className="h-4 w-4" />
                        )}
                    </button>
                );
            },
            cell: (info) => (
                <span className="font-medium text-blue-600">
                    {String(info.getValue())}
                </span>
            ),
            enableSorting: true,
            // 포함개수가 같을 때 길이로 정렬하기 위한 sortingFn 추가
            sortingFn: isMission.m ? (rowA, rowB) => {
                const countA = getCharCount(rowA.original.word, isMission.t || '');
                const countB = getCharCount(rowB.original.word, isMission.t || '');
                
                // 포함개수가 다르면 포함개수로 정렬
                if (countA !== countB) {
                    return countA - countB;
                }
                
                // 포함개수가 같으면 길이로 정렬 (길이가 긴 것이 위로)
                return rowA.original.word.length - rowB.original.word.length;
            } : (rowA, rowB) => rowA.original.word.length - rowB.original.word.length
            ,
        },
        { 
            accessorKey: "word", 
            header: ({ column }) => {
                const isSorted = column.getIsSorted();
                return (
                    <button
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        단어
                        {isSorted === "desc" ? (
                            <ArrowDown className="h-4 w-4" />
                        ) : isSorted === "asc" ? (
                            <ArrowUp className="h-4 w-4" />
                        ) : (
                            <ArrowUpDown className="h-4 w-4" />
                        )}
                    </button>
                );
            },
            cell: ({ getValue }) => {
                const word = getValue() as string;
                return (
                    <Link href={`/word/search/${word}`} className="font-semibold text-gray-900 underline dark:text-gray-100">
                        {isMission.m && isMission.t ? (
                            word.split("").map((char, i) => (
                                char === isMission.t ? <span key={i} className="text-green-500">{char}</span> : char
                            ))
                        ) : (
                            word
                        )}
                    </Link>
                );
            }
        },
        { 
            accessorKey: "status", 
            header: "상태",
            cell: ({ getValue }) => {
                const status = getValue() as string;
                const getStatusStyle = (status: string) => {
                    switch (status) {
                        case "ok":
                            return "bg-green-100 text-green-800 border-green-200";
                        case "add":
                            return "bg-blue-100 text-blue-800 border-blue-200";
                        case "delete":
                            return "bg-red-100 text-red-800 border-red-200";
                        case "eadd":
                            return "bg-purple-100 text-purple-800 border-purple-200";
                        case "edelete":
                            return "bg-orange-100 text-orange-800 border-orange-200";
                        default:
                            return "bg-gray-100 text-gray-800 border-gray-200";
                    }
                };
                
                return (
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(status)}`}>
                        {status}
                    </span>
                );
            }
        },
    ], [isMission, getCharCount]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
        onSortingChange: setSorting,
    });

    const openWork = useCallback((row: DocsWordData) => {
        setModal(row);
    }, []);

    const closeWork = () => {
        setModal(null);
    };

    const CompleWork = () => {
        setModal(null);
        setIsCompleteModalOpen(true);
    };

    const makeError = (error: UserWordRequestError) => {
        closeWork();
        seterrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.stack,
            inputValue: null
        });
        setIsProcessing(false);
    };

    const {
        approve,
        reject,
        deleteDirectly,
        isPending: isAdminMutationPending,
        error: adminMutationError,
        clearError,
    } = useDocsWordModeration();
    const {
        CancelAddRequest,
        CancelDeleteRequest,
        RequestDelete,
    } = useUserWordRequestActions({
        makeError,
        setIsProcessing,
        user,
        completeWork: CompleWork,
        isProcessing,
    });

    const showAdminError = useCallback((error: ApplicationError) => {
        seterrorModalView({
            ErrName: "DocsWordModerationError",
            ErrMessage: getAdminErrorMessage(error),
            ErrStackRace: null,
            inputValue: null,
        });
    }, []);

    useEffect(() => {
        if (adminMutationError !== null) showAdminError(adminMutationError);
    }, [adminMutationError, showAdminError]);

    const completeAdminAction = async (
        action: DocsWordAdminAction,
        row: DocsWordData,
    ) => {
        await onAdminActionComplete(action, row);
        closeWork();
    };

    const runRequestModeration = async (
        action: "approve" | "reject",
        row: DocsWordData,
    ) => {
        if (!isRequestTargetForRow(row)) return;

        clearError();
        setIsAdminTransitionPending(true);
        try {
            const result = await (action === "approve"
                ? approve(row.mutationTarget)
                : reject(row.mutationTarget));
            if (!result.ok) {
                showAdminError(result.error);
                return;
            }
            await completeAdminAction(action, row);
        } finally {
            setIsAdminTransitionPending(false);
        }
    };

    const runDirectDeletion = async (row: DocsWordData) => {
        if (row.status !== "ok" || row.mutationTarget?.kind !== "registered-word") return;

        clearError();
        setIsAdminTransitionPending(true);
        try {
            const result = await deleteDirectly(row.mutationTarget);
            if (!result.ok) {
                showAdminError(result.error);
                return;
            }
            await completeAdminAction("delete-directly", row);
        } finally {
            setIsAdminTransitionPending(false);
        }
    };

    const isSaving = isAdminMutationPending || isAdminTransitionPending || isProcessing;

    return (
        <div className="w-full mx-auto">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : typeof header.column.columnDef.header === 'function'
                                                ? header.column.columnDef.header(header.getContext())
                                                : header.column.columnDef.header}
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                        작업
                                    </th>
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {table.getRowModel().rows.map((row, index) => {
                                const wordData = row.original;
                                return (
                                    <tr 
                                        key={wordData.word}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                            index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-25 dark:bg-gray-800'
                                        }`}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
                                            >
                                                {typeof cell.column.columnDef.cell === 'function'
                                                    ? cell.column.columnDef.cell(cell.getContext())
                                                    : cell.getValue() as string}
                                            </td>
                                        ))}
                                        {/* 작업 버튼 */}
                                        <td className="min-w-[100px] px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                                            {openWork !== undefined && user.uuid && (
                                                <button
                                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition"
                                                    onClick={user.uuid !== undefined ?
                                                        () => openWork(wordData) :
                                                        undefined
                                                    }
                                                >
                                                    작업
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {/* 테이블이 비어있을 때 */}
                {table.getRowModel().rows.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">데이터가 없습니다.</p>
                    </div>
                )}
            </div>

            {/* 모달 영역 */}
            {modal && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
                            <Spinner />
                        </div>
                    </div>
                }>
                    <WorkModal
                        isSaving={isSaving}
                        onClose={closeWork}
                        word={modal.word}
                        status={modal.status}
                        isAdmin={user.role === "admin"}
                        isRequester={
                            modal.mutationTarget?.kind === "word-request"
                            && user.uuid === modal.maker
                        }
                        onAddAccept={isRequestTargetForRow(modal) && modal.status === "add"
                            ? () => runRequestModeration("approve", modal)
                            : undefined}
                        onDeleteAccept={isRequestTargetForRow(modal) && modal.status === "delete"
                            ? () => runRequestModeration("approve", modal)
                            : undefined}
                        onAddReject={isRequestTargetForRow(modal) && modal.status === "add"
                            ? () => runRequestModeration("reject", modal)
                            : undefined}
                        onDeleteReject={isRequestTargetForRow(modal) && modal.status === "delete"
                            ? () => runRequestModeration("reject", modal)
                            : undefined}
                        onCancelAddRequest={() => CancelAddRequest(modal.word)}
                        onCancelDeleteRequest={() => CancelDeleteRequest(modal.word)}
                        onDelete={modal.status === "ok" && modal.mutationTarget?.kind === "registered-word"
                            ? () => runDirectDeletion(modal)
                            : undefined}
                        onRequestDelete={() => RequestDelete(modal.word)}
                    />
                </Suspense>
            )}

            {errorModalView && (
                <ErrorModal
                    onClose={() => {
                        seterrorModalView(null);
                        clearError();
                    }}
                    error={errorModalView}
                />
            )}

            {isProcessing && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
                        <Spinner />
                    </div>
                </div>
            )}
            
            {isCompleteModalOpen && (
                <CompleteModal 
                    onClose={() => setIsCompleteModalOpen(false)} 
                    open={isCompleteModalOpen}
                />
            )}
        </div>
    );
};

export default memo(Table);
