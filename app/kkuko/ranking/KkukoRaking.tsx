'use client';

import { Trophy, TrendingUp, Target, Gamepad2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { ModeSelector } from './components/ModeSelector';
import { RankingList } from './components/RankingList';
import { RankingPagination } from './components/RankingPagination';
import { Podium } from './components/Podium';
import { useKkukoRanking } from './hooks/useKkukoRanking';
import ErrorModal from '../../components/ErrModal';

export default function KkukoRanking() {
    const {
        modes,
        selectedMode,
        rankings,
        option,
        page,
        loading,
        modesLoading,
        detailedError,
        setDetailedError,
        handleModeChange,
        handleOptionChange,
        handlePageChange: onPageChange
    } = useKkukoRanking();

    const handlePageChange = (newPage: number) => {
        onPageChange(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (modesLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
                <div className="text-gray-900 dark:text-white text-lg">로딩 중...</div>
            </div>
        );
    }

    const hasNextPage = rankings.length === 30;
    const topThree = page === 1 ? rankings.filter(r => r.rank <= 3) : [];
    const remainingRankings = page === 1 ? rankings.filter(r => r.rank > 3) : rankings;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Trophy className="w-12 h-12 text-yellow-600 dark:text-yellow-500" />
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">끄투코리아 랭킹</h1>
                    </div>
                    <p className="text-gray-700 dark:text-gray-400 text-lg">모드별 최고의 플레이어들을 만나보세요</p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white/80 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-300 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-gray-900 dark:text-white font-semibold">모드 선택:</span>
                        <ModeSelector 
                            modes={modes}
                            selectedMode={selectedMode}
                            onModeChange={handleModeChange}
                        />
                    </div>

                    <Tabs value={option} onValueChange={handleOptionChange}>
                        <TabsList className="bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700">
                            <TabsTrigger 
                                value="win"
                                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                            >
                                <TrendingUp className="w-4 h-4 mr-2" />
                                승리 순위
                            </TabsTrigger>
                            <TabsTrigger 
                                value="exp"
                                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                            >
                                <Trophy className="w-4 h-4 mr-2" />
                                경험치 순위
                            </TabsTrigger>
                            <TabsTrigger 
                                value="total"
                                className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                            >
                                <Gamepad2 className="w-4 h-4 mr-2" />
                                플레이 판 수
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Rankings */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-white"></div>
                        <p className="text-gray-900 dark:text-white mt-4">랭킹을 불러오는 중...</p>
                    </div>
                ) : (
                    <>
                        {/* Podium for top 3 on first page */}
                        {topThree.length > 0 && <Podium topThree={topThree} option={option} />}
                        
                        {/* Remaining rankings */}
                        <RankingList rankings={remainingRankings} option={option} />
                        
                        <RankingPagination 
                            currentPage={page}
                            onPageChange={handlePageChange}
                            hasNextPage={hasNextPage}
                        />
                    </>
                )}
            </div>

            {/* Error Modal */}
            {detailedError && (
                <ErrorModal 
                    error={detailedError} 
                    onClose={() => setDetailedError(null)} 
                />
            )}
        </div>
    );
}
