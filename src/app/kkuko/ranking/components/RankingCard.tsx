'use client';

import Link from 'next/link';
import { Trophy, TrendingUp } from 'lucide-react';
import { Card } from '@/src/app/components/ui/card';
import type { RankingEntry, RankingOption } from '@/src/app/types/kkuko.types';

interface RankingCardProps {
    entry: RankingEntry;
    option: RankingOption;
}

export function RankingCard({ entry, option }: RankingCardProps) {
    const { rank, userRecord, userInfo } = entry;

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-500 dark:text-yellow-400';
        if (rank === 2) return 'text-gray-500 dark:text-gray-400';
        if (rank === 3) return 'text-amber-700 dark:text-amber-600';
        return 'text-gray-600 dark:text-gray-500';
    };

    const getRankBg = (rank: number) => {
        if (rank === 1) return 'bg-gradient-to-r from-yellow-100/50 to-yellow-200/30 dark:from-yellow-500/20 dark:to-yellow-600/10';
        if (rank === 2) return 'bg-gradient-to-r from-gray-100/50 to-gray-200/30 dark:from-gray-400/20 dark:to-gray-500/10';
        if (rank === 3) return 'bg-gradient-to-r from-amber-100/50 to-amber-200/30 dark:from-amber-700/20 dark:to-amber-800/10';
        return 'bg-gradient-to-r from-gray-50/50 to-gray-100/30 dark:from-slate-800/50 dark:to-slate-900/30';
    };

    const winRate = userRecord.total > 0 
        ? ((userRecord.win / userRecord.total) * 100).toFixed(1) 
        : '0.0';

    return (
        <Card className={`${getRankBg(rank)} border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300 hover:scale-[1.02]`}>
            <div className="p-4 flex items-center gap-4">
                {/* Rank */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full ${getRankColor(rank)} flex items-center justify-center font-bold text-xl bg-white dark:bg-slate-900/50 border-2 border-gray-200 dark:border-slate-700`}>
                    {rank <= 3 ? <Trophy className="w-6 h-6" /> : rank}
                </div>

                {/* User Info */}
                <div className="flex-grow min-w-0">
                    <Link 
                        href={`/kkuko/profile?nick=${encodeURIComponent(userInfo.nickname)}`}
                        className="text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors block truncate"
                    >
                        {userInfo.nickname}
                    </Link>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Lv.{userInfo.level} • {userInfo.exordial}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex-shrink-0 flex gap-6 text-sm">
                    <div className="text-center">
                        <div className="text-gray-600 dark:text-gray-400 mb-1">
                            {option === 'exp' ? '경험치' : option === 'total' ? '플레이 판 수' : '승리'}
                        </div>
                        <div className="text-gray-900 dark:text-white font-bold flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-500" />
                            {option === 'exp' 
                                ? userRecord.exp.toLocaleString() 
                                : option === 'total'
                                    ? userRecord.total.toLocaleString()
                                    : userRecord.win.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-gray-600 dark:text-gray-400 mb-1">승률</div>
                        <div className="text-gray-900 dark:text-white font-bold">
                            {winRate}%
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-gray-600 dark:text-gray-400 mb-1">총 게임</div>
                        <div className="text-gray-900 dark:text-white font-bold">
                            {userRecord.total.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
