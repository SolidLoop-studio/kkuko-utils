'use client';

import { RankingCard } from './RankingCard';
import type { RankingEntry, RankingOption } from '@/src/app/types/kkuko.types';

interface RankingListProps {
    rankings: RankingEntry[];
    option: RankingOption;
}

export function RankingList({ rankings, option }: RankingListProps) {
    if (rankings.length === 0) {
        return (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <p className="text-lg">랭킹 데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rankings.map((entry) => (
                <RankingCard 
                    key={`${entry.userRecord.userId}-${entry.rank}`} 
                    entry={entry} 
                    option={option}
                />
            ))}
        </div>
    );
}
