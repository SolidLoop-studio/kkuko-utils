"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { SCM } from "@/app/lib/supabaseClient";
import { BarChart3, TrendingUp, Loader2, AlertCircle, Search, ArrowUpDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Database } from "@/app/types/database.types";
import Link from 'next/link';

type word_first_letter_counts = Database['public']['Tables']['word_first_letter_counts']['Row'];
type word_last_letter_counts = Database['public']['Tables']['word_last_letter_counts']['Row'];

type ViewMode = 'first' | 'last' | 'len3';
type SortField = 'letter' | 'k_count' | 'n_count';
type SortOrder = 'asc' | 'desc';
type CompareOperator = '=' | '>' | '<' | '>=' | '<=';

export function WordStatsHome() {
    const [firstLetterCounts, setFirstLetterCounts] = useState<word_first_letter_counts[]>([]);
    const [lastLetterCounts, setLastLetterCounts] = useState<word_last_letter_counts[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // 필터 및 정렬 상태
    const [viewMode, setViewMode] = useState<ViewMode>('first');
    const [searchLetter, setSearchLetter] = useState('');
    const [countFilter, setCountFilter] = useState('');
    const [compareOp, setCompareOp] = useState<CompareOperator>('>=');
    const [sortField, setSortField] = useState<SortField>('k_count');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    
    // 가상 스크롤을 위한 ref
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data, error } = await SCM.get().wordState();
                
                if (error) {
                    setError(error.message);
                    return;
                }
                
                if (data) {
                    setFirstLetterCounts(data.firstLetterCounts);
                    setLastLetterCounts(data.lastLetterCounts);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 필터링 및 정렬 로직
    const filteredAndSortedData = useMemo(() => {
        let data: Array<{
            letter: string;
            k_count: number;
            n_count: number;
            k_updated: string | null;
            n_updated: string | null;
        }> = [];

        if (viewMode === 'first') {
            data = firstLetterCounts.map(item => ({
                letter: item.first_letter,
                k_count: item.k_count,
                n_count: item.n_count,
                k_updated: item.k_count_updated_at,
                n_updated: item.n_count_updated_at,
            }));
        } else if (viewMode === 'last') {
            data = lastLetterCounts.map(item => ({
                letter: item.last_letter,
                k_count: item.k_count,
                n_count: item.n_count,
                k_updated: item.k_count_updated_at,
                n_updated: item.n_count_updated_at,
            }));
        } else if (viewMode === 'len3') {
            data = firstLetterCounts.map(item => ({
                letter: item.first_letter,
                k_count: item.len3_k_count,
                n_count: item.len3_n_count,
                k_updated: item.len3_k_count_updated_at,
                n_updated: item.len3_n_count_updated_at,
            }));
        }

        // 글자 검색 필터
        if (searchLetter.trim()) {
            data = data.filter(item => item.letter.includes(searchLetter.trim()));
        }

        // 카운트 필터
        if (countFilter.trim()) {
            const filterValue = parseInt(countFilter.trim());
            if (!isNaN(filterValue)) {
                data = data.filter(item => {
                    const maxCount = Math.max(item.k_count, item.n_count);
                    switch (compareOp) {
                        case '=': return maxCount === filterValue;
                        case '>': return maxCount > filterValue;
                        case '<': return maxCount < filterValue;
                        case '>=': return maxCount >= filterValue;
                        case '<=': return maxCount <= filterValue;
                        default: return true;
                    }
                });
            }
        }

        // 정렬
        data.sort((a, b) => {
            let compareValue = 0;
            
            if (sortField === 'letter') {
                compareValue = a.letter.localeCompare(b.letter, 'ko');
            } else if (sortField === 'k_count') {
                compareValue = a.k_count - b.k_count;
            } else if (sortField === 'n_count') {
                compareValue = a.n_count - b.n_count;
            }

            return sortOrder === 'asc' ? compareValue : -compareValue;
        });

        return data;
    }, [firstLetterCounts, lastLetterCounts, viewMode, searchLetter, countFilter, compareOp, sortField, sortOrder]);

    // 가상 스크롤러 설정
    const virtualizer = useVirtualizer({
        count: filteredAndSortedData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 140, // 각 아이템의 예상 높이
        overscan: 5, // 화면 밖에 미리 렌더링할 아이템 수
    });

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '정보 없음';
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-300">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    const maxCount = filteredAndSortedData.length > 0 
        ? Math.max(...filteredAndSortedData.map(x => Math.max(x.k_count, x.n_count)), 1)
        : 1;

    const getModeTitle = () => {
        switch (viewMode) {
            case 'first': return '첫 글자별 통계';
            case 'last': return '끝 글자별 통계';
            case 'len3': return '쿵쿵따 첫 글자별 통계';
        }
    };

    const getModeColor = () => {
        switch (viewMode) {
            case 'first': return 'from-indigo-500 to-purple-500';
            case 'last': return 'from-yellow-500 to-lime-500';
            case 'len3': return 'from-orange-500 to-red-500';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <BarChart3 className="w-8 h-8 text-indigo-500 mr-3" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                            단어 통계
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg">
                        각 글자별 단어 개수 통계를 확인하세요
                    </p>
                </div>

                {/* 뷰 모드 선택 */}
                <div className="mb-6 flex flex-wrap gap-3 justify-center">
                    <button
                        onClick={() => setViewMode('first')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                            viewMode === 'first'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105'
                                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:shadow-md'
                        }`}
                    >
                        첫 글자 통계
                    </button>
                    <button
                        onClick={() => setViewMode('last')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                            viewMode === 'last'
                                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg scale-105'
                                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:shadow-md'
                        }`}
                    >
                        끝 글자 통계
                    </button>
                    <button
                        onClick={() => setViewMode('len3')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                            viewMode === 'len3'
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:shadow-md'
                        }`}
                    >
                        쿵쿵따 통계
                    </button>
                </div>

                {/* 필터 및 검색 */}
                <div className="mb-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 글자 검색 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                <Search className="w-4 h-4 inline mr-1" />
                                글자 검색
                            </label>
                            <input
                                type="text"
                                value={searchLetter}
                                onChange={(e) => setSearchLetter(e.target.value)}
                                placeholder="예: 가"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* 카운트 필터 연산자 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                비교 연산자
                            </label>
                            <select
                                value={compareOp}
                                onChange={(e) => setCompareOp(e.target.value as CompareOperator)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="=">=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                            </select>
                        </div>

                        {/* 카운트 필터 값 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                카운트 필터
                            </label>
                            <input
                                type="number"
                                value={countFilter}
                                onChange={(e) => setCountFilter(e.target.value)}
                                placeholder="예: 100"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* 정렬 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                <ArrowUpDown className="w-4 h-4 inline mr-1" />
                                정렬
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                >
                                    <option value="letter">가나다순</option>
                                    <option value="k_count">어인정O</option>
                                    <option value="n_count">어인정X</option>
                                </select>
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    className="px-3 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                                    title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
                                >
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 통계 표시 */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                            <TrendingUp className="w-6 h-6 text-indigo-500 mr-2" />
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {getModeTitle()}
                            </h2>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {filteredAndSortedData.length}개 항목
                        </div>
                    </div>
                    
                    <div 
                        ref={parentRef}
                        className="max-h-[600px] overflow-y-auto pr-2"
                    >
                        {filteredAndSortedData.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                검색 결과가 없습니다.
                            </div>
                        ) : (
                            <div
                                style={{
                                    height: `${virtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {virtualizer.getVirtualItems().map((virtualRow) => {
                                    const item = filteredAndSortedData[virtualRow.index];
                                    if (!item) return null;
                                    
                                    return (
                                        <div
                                            key={virtualRow.key}
                                            data-index={virtualRow.index}
                                            ref={virtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                        >
                                            <div className="mb-4 group border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
                                                <div className="flex items-center justify-between mb-3">
                                                    <Link 
                                                        href={`/word/search?mode=${viewMode === 'first' ? 'f' : viewMode === 'last' ? 'l' : 'k'}&q=${item.letter}`}
                                                        className="text-2xl font-bold text-slate-800 dark:text-slate-100 underline cursor-pointer"
                                                    >
                                                        {item.letter}
                                                    </Link>
                                                    <div className="flex gap-6 text-sm">
                                                        <div className="text-center">
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">어인정O</div>
                                                            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                                {item.k_count.toLocaleString()}
                                                            </div>
                                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                                {formatDate(item.k_updated)}
                                                            </div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">어인정X</div>
                                                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                                {item.n_count.toLocaleString()}
                                                            </div>
                                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                                {formatDate(item.n_updated)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* 한방 진행 바 */}
                                                <div className="mb-2">
                                                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                        <span>어인정O</span>
                                                    </div>
                                                    <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${getModeColor()} rounded-full transition-all duration-500`}
                                                            style={{ width: `${(item.k_count / maxCount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* 일반 진행 바 */}
                                                <div>
                                                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                        <span>어인정X</span>
                                                    </div>
                                                    <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${(item.n_count / maxCount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 요약 통계 */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-4 text-center">
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">총 글자 종류</p>
                        <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                            {filteredAndSortedData.length}
                        </p>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-4 text-center">
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">총 어인정O 카운트 수</p>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                            {filteredAndSortedData.reduce((sum, item) => sum + item.k_count, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-4 text-center">
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">총 어인정X 카운트 수</p>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {filteredAndSortedData.reduce((sum, item) => sum + item.n_count, 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
