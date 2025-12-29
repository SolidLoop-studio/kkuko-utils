"use client";
import Link from "next/link";
import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { convertQwertyToHangul } from "es-hangul";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import LoginRequiredModal from "../components/LoginRequiredModal";
import { SCM } from "@/lib/supabaseClient";
import CompleteModal from "../components/CompleteModal";

interface Document {
    id: string;
    name: string;
    maker: string;
    last_update: string;
    created_at: string;
    is_manager: boolean;
    typez: "letter" | "theme" | "ect";
}

interface WordsDocsHomeProps {
    docs: Document[];
}

const WordsDocsHome = ({ docs }: WordsDocsHomeProps) => {
    const typeOrder = ['letter', 'theme', 'ect'];
    const typeNames = {
        'letter': '글자',
        'theme': '주제',
        'ect': '특수'
    };

    const [expandedTypes, setExpandedTypes] = useState<{ [key: string]: boolean }>(
        typeOrder.reduce((acc, type) => ({ ...acc, [type]: true }), {})
    );

    const [sortOptions, setSortOptions] = useState<{ 
        [key: string]: { field: string; direction: 'asc' | 'desc' } 
    }>(
        typeOrder.reduce((acc, type) => ({ 
            ...acc, 
            [type]: { field: "last_update", direction: "desc" } 
        }), {})
    );

    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDocName, setNewDocName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [newDocError, setNewDocError] = useState<string|null>(null);
    const [newDocLoading, setNewDocLoading] = useState(false);
    const [showComplete, setShowComplete] = useState(false);
    const [showNeedLogin, setShowNeedLogin] = useState(false);
    const user = useSelector((state: RootState) => state.user);

    const toggleType = (typez: string) => {
        setExpandedTypes(prev => ({ ...prev, [typez]: !prev[typez] }));
    };

    const handleSort = (typez: string, field: string) => {
        setSortOptions(prev => {
            const currentSort = prev[typez];
            const direction = currentSort.field === field && currentSort.direction === 'desc' ? 'asc' : 'desc';
            return { 
                ...prev, 
                [typez]: { field, direction } 
            };
        });
    };

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const clearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    const sortDocs = (docs: Document[], sortType: { field: string; direction: 'asc' | 'desc' }) => {
        const sorted = [...docs];
        const { field, direction } = sortType;
        
        sorted.sort((a, b) => {
            let comparison = 0;
            
            switch (field) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "created_at":
                    comparison = (a.created_at || "").localeCompare(b.created_at || "");
                    break;
                case "last_update":
                default:
                    comparison = a.last_update.localeCompare(b.last_update);
                    break;
            }
            
            return direction === 'asc' ? comparison : -comparison;
        });
        
        return sorted;
    };

    const formatDate = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ko });
        } catch {
            return dateString;
        }
    };

    // 검색 쿼리에 따른 필터링된 문서 목록
    const filteredDocs = useMemo(() => {
        if (!searchQuery.trim()) {
            return docs;
        }
        
        const query = searchQuery.toLowerCase().trim();
        return docs.filter(doc => 
            doc.name.toLowerCase().includes(query) || doc.name.toLocaleLowerCase().includes(convertQwertyToHangul(query))
        );
    }, [docs, searchQuery]);

    // 필터링된 문서를 타입별로 그룹화
    const groupedDocs = useMemo(() => {
        return filteredDocs.reduce<{ [key: string]: Document[] }>((acc, doc) => {
            acc[doc.typez] = acc[doc.typez] || [];
            acc[doc.typez].push(doc);
            return acc;
        }, {});
    }, [filteredDocs]);

    // 모달 열기
    const openAddModal = () => {
        if (!user.uuid){
            return setShowNeedLogin(true);
        }
        setShowAddModal(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // 모달 닫기
    const closeAddModal = () => {
        setShowAddModal(false);
        setNewDocName("");
    };

    // 입력값 1글자 제한
    const handleNewDocNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length <= 1) setNewDocName(value);
    };

    // 확인 버튼 클릭 시 호출할 함수 (props로 전달하거나 직접 구현)
    const handleAddDocRequest = async () => {
        if (newDocName.length === 1 && user.uuid) {
            setNewDocLoading(true);
            setNewDocError(null);

            const {data: checkData ,error: checkError} = await SCM.get().letterDocs();
            const {data: checkData2, error: checkError2} = await SCM.get().addWaitDocs();
            if (checkError) {
                setNewDocError("문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
                setTimeout(() => {
                    setNewDocError(null);
                }, 3000);
                setNewDocLoading(false);
                return;
            }
            if (checkError2) {
                setNewDocError("문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요." + checkError2.message + checkError2.details);
                setTimeout(() => {
                    setNewDocError(null);
                }, 3000);
                setNewDocLoading(false);
                return;
            }
            if (checkData.some(doc => doc.name === newDocName)) {
                setNewDocError("이미 존재하는 문서명입니다.");
                setTimeout(() => {
                    setNewDocError(null);
                }, 3000);
                setNewDocLoading(false);
                return;
            }
            if (checkData2.some(doc => doc.docs_name === newDocName)) {
                setNewDocError("이미 추가 요청된 문서명입니다.");
                setTimeout(() => {
                    setNewDocError(null);
                }, 3000);
                setNewDocLoading(false);
                return;
            }

            const {error} = await SCM.add().waitDocs({
                docsName: newDocName,
                userId: user.uuid
            })
            if (error) {
                setNewDocError("문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요." + error.message + error.details);
                setTimeout(() => {
                    setNewDocError(null);
                }, 3000);
                setNewDocLoading(false);
                return;
            }

            closeAddModal();
            setShowComplete(true);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
            { /* 로그인 필요 모달 */}
            {showNeedLogin && (
                <LoginRequiredModal open={showNeedLogin} onClose={() => setShowNeedLogin(false)} />
            )}

            {/* 완료 모달 */}
            {showComplete && (
                <CompleteModal open={showComplete} onClose={() => setShowComplete(false)} />
            )}

            {/* 추가요청 모달 - 개선된 디자인 */}
            {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md relative border border-gray-200 dark:border-gray-700 transform transition-all duration-300 scale-100">
                {/* 닫기 버튼 */}
                <button
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
                    onClick={closeAddModal}
                    aria-label="닫기"
                    disabled={newDocLoading}
                >
                    ✕
                </button>
                
                {/* 헤더 */}
                <div className="mb-6">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">새 문서 추가 요청</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">원하시는 글자 문서 이름을 입력해주세요.</p>
                </div>
                
                {/* 입력 필드 */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    문서명
                    </label>
                    <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newDocName}
                        onChange={handleNewDocNameChange}
                        maxLength={1}
                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center text-2xl font-bold transition-all duration-200"
                        placeholder="가"
                    />
                    <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                        {newDocName.length}/1
                    </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    한 글자만 입력 가능합니다
                    </p>
                    {newDocError && (
                    <p className="text-sm text-red-500 mt-2">
                        {newDocError}
                    </p>
                    )}
                </div>
                
                {/* 버튼 */}
                <div className="flex space-x-3">
                    <button
                    onClick={closeAddModal}
                    className="flex-1 py-3 px-4 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 font-medium"
                    disabled={newDocLoading}
                    >
                    취소
                    </button>
                    <button
                    onClick={handleAddDocRequest}
                    disabled={newDocName.length !== 1}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                        newDocName.length === 1
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                    >
                    {newDocLoading ? "저장 중..." : newDocName.length === 1 ? "문서 추가 요청" : "글자 입력 필요"}
                    </button>
                </div>
                </div>
            </div>
            )}

            {/* 검색창 - 개선된 디자인 */}
            <div className="w-full max-w-6xl mb-4">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors duration-200" />
                </div>
                <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="문서명으로 검색하세요..."
                className="w-full p-4 pl-12 pr-12 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {searchQuery && (
                <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-2xl transition-all duration-200"
                    aria-label="검색 지우기"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                )}
            </div>
            
            {/* 검색 결과 표시 */}
            {searchQuery && (
                <div className="mt-3 flex items-center space-x-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>검색 결과: <span className="font-semibold text-blue-600 dark:text-blue-400">{filteredDocs.length}</span>개의 문서</span>
                </div>
                </div>
            )}
            </div>

            {/* 글자문서 추가요청 버튼 - 개선된 디자인 */}
            <div className="w-full max-w-6xl flex justify-end mb-2">
            <button
                onClick={openAddModal}
                className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-medium flex items-center space-x-2"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>새 문서 추가 요청</span>
                
                {/* 호버 효과 */}
                <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </button>
            </div>

            {/* 필터링된 결과가 없을 때 보여줄 메시지 */}
            {searchQuery && filteredDocs.length === 0 && (
                <div className="w-full max-w-6xl p-8 bg-white dark:bg-gray-800 shadow rounded-md text-center">
                    <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
                </div>
            )}

            {/* 문서 목록 */}
            {typeOrder.map((typez) => (
                <div key={typez} className="w-full max-w-6xl mb-6">
                    <button
                        onClick={() => toggleType(typez)}
                        className="w-full text-left font-semibold text-lg p-4 bg-white dark:bg-gray-800 shadow rounded-md flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        <span className="text-gray-900 dark:text-gray-100">
                            {typeNames[typez as keyof typeof typeNames] || typez} ({groupedDocs[typez]?.length || 0})
                        </span>
                        {expandedTypes[typez] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>

                    <AnimatePresence initial={false}>
                        {expandedTypes[typez] && groupedDocs[typez] && (
                            <motion.div
                                key={typez}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden bg-white dark:bg-gray-800 shadow rounded-md mt-2"
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                            <tr>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-1/2" 
                                                    onClick={() => handleSort(typez, "name")}
                                                >
                                                    <div className="flex items-center">
                                                        문서명
                                                        {sortOptions[typez].field === "name" && (
                                                            sortOptions[typez].direction === "desc" ? 
                                                            <ArrowDownIcon className="ml-1" /> : 
                                                            <ArrowUpIcon className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" 
                                                    onClick={() => handleSort(typez, "last_update")}
                                                >
                                                    <div className="flex items-center">
                                                        최근 업데이트
                                                        {sortOptions[typez].field === "last_update" && (
                                                            sortOptions[typez].direction === "desc" ? 
                                                            <ArrowDownIcon className="ml-1" /> : 
                                                            <ArrowUpIcon className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" 
                                                    onClick={() => handleSort(typez, "created_at")}
                                                >
                                                    <div className="flex items-center">
                                                        생성일
                                                        {sortOptions[typez].field === "created_at" && (
                                                            sortOptions[typez].direction === "desc" ? 
                                                            <ArrowDownIcon className="ml-1" /> : 
                                                            <ArrowUpIcon className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortDocs(groupedDocs[typez] || [], sortOptions[typez]).map((doc) => (
                                                <tr 
                                                    key={doc.id}
                                                    className={`border-t border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900 ${hoveredRow === doc.id ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
                                                    onMouseEnter={() => setHoveredRow(doc.id)}
                                                    onMouseLeave={() => setHoveredRow(null)}
                                                >
                                                    <td className="px-4 py-3">
                                                        <Link 
                                                            href={`/words-docs/${doc.id}`}
                                                            className="font-semibold text-base text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center"
                                                        >
                                                            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-2"></div>
                                                            {doc.name}
                                                            {searchQuery && doc.name.toLowerCase().includes(searchQuery.toLowerCase()) && (
                                                                <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">검색 일치</span>
                                                            )}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-300">
                                                        {formatDate(doc.last_update)}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-300">
                                                        {formatDate(doc.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {(groupedDocs[typez]?.length === 0) && (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        {searchQuery ? '검색 결과가 없습니다.' : '문서가 없습니다.'}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
};

export default WordsDocsHome;