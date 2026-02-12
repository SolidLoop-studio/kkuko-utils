'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, User, Crown } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import type { RankingEntry, RankingOption, ProfileData } from '@/app/types/kkuko.types';
import ProfileAvatar from '../../shared/components/ProfileAvatar';
import { fetchProfile, fetchItems } from '../../shared/lib/api';

interface PodiumProps {
    topThree: RankingEntry[];
    option: RankingOption;
}

export function Podium({ topThree, option }: PodiumProps) {
    // 1. Fetch Profiles for top 3 users
    const topThreeIds = topThree.slice(0, 3).map(entry => entry.userInfo.id).join(',');

    const { data: profiles = {} } = useQuery({
        queryKey: ['podium-profiles', topThreeIds],
        queryFn: async () => {
            if (!topThreeIds) return {};
            
            const validEntries = topThree.slice(0, 3);
            const profilePromises = validEntries.map(entry => 
                fetchProfile(entry.userInfo.id, 'id')
                    .then(res => (res.data && res.data.status === 200) ? res.data.data : null)
                    .catch(err => {
                        console.error(`Failed to fetch profile for ${entry.userInfo.nickname}`, err);
                        return null;
                    })
            );

            const resolvedProfiles = (await Promise.all(profilePromises)).filter((p): p is ProfileData => p !== null);
            
            const newProfiles: Record<string, ProfileData> = {};
            resolvedProfiles.forEach(p => {
                if (!p || !p.user) return;
                newProfiles[p.user.id] = p;
            });
            return newProfiles;
        },
        enabled: topThree.length > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // 2. Extract item IDs from fetched profiles
    const allItemIds = new Set<string>();
    Object.values(profiles).forEach(p => {
        if (p.equipment) {
            p.equipment.forEach(e => {
                if (e.itemId) allItemIds.add(e.itemId);
            });
        }
    });
    const itemIdsString = Array.from(allItemIds).join(',');

    // 3. Fetch Items
    const { data: itemsData = [] } = useQuery({
        queryKey: ['podium-items', itemIdsString],
        queryFn: async () => {
             if (!itemIdsString) return [];
             const itemsResponse = await fetchItems(itemIdsString);
             if (itemsResponse.data && itemsResponse.data.status === 200) {
                 return itemsResponse.data.data;
             }
             return [];
        },
        enabled: allItemIds.size > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (topThree.length === 0) return null;

    // Ensure we have the entries for 1st, 2nd, 3rd
    const first = topThree.find(e => e.rank === 1);
    const second = topThree.find(e => e.rank === 2);
    const third = topThree.find(e => e.rank === 3);

    // Order: 2nd, 1st, 3rd
    const orderedEntries = [second, first, third].filter(Boolean) as RankingEntry[];

    const getPodiumConfig = (rank: number) => {
        switch (rank) {
            case 1:
                return {
                    height: 'h-[400px]',
                    width: 'scale-110 z-10', // Slightly larger and in front
                    color: 'bg-gradient-to-b from-yellow-400 to-yellow-600',
                    border: 'border-yellow-200',
                    textGlow: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]',
                    badge: 'bg-yellow-500 text-white shadow-yellow-900/20'
                };
            case 2:
                return {
                    height: 'h-[340px]',
                    width: 'scale-100',
                    color: 'bg-gradient-to-b from-gray-300 to-gray-500', 
                    border: 'border-gray-200',
                    textGlow: 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]',
                    badge: 'bg-gray-500 text-white shadow-gray-900/20'
                };
            case 3:
                return {
                    height: 'h-[280px]',
                    width: 'scale-100',
                    color: 'bg-gradient-to-b from-amber-600 to-amber-800', 
                    border: 'border-amber-400',
                    textGlow: 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]',
                    badge: 'bg-amber-700 text-white shadow-amber-900/20'
                };
            default:
                return {
                    height: 'h-[200px]',
                    width: 'scale-100',
                    color: 'bg-slate-700',
                    border: 'border-slate-600',
                    textGlow: '',
                    badge: 'bg-slate-700 text-white'
                };
        }
    };

    const winRate = (entry: RankingEntry) => {
        return entry.userRecord.total > 0 
            ? ((entry.userRecord.win / entry.userRecord.total) * 100).toFixed(1) 
            : '0.0';
    };

    return (
        <div className="flex items-end justify-center w-full max-w-5xl mx-auto px-4 gap-2 sm:gap-4 mb-8 pt-10">
            {orderedEntries.map((entry) => {
                const config = getPodiumConfig(entry.rank);
                const isFirst = entry.rank === 1;
                const userProfile = profiles[entry.userInfo.id];

                return (
                    <div 
                        key={entry.rank} 
                        className={`flex flex-col items-center flex-1 min-w-[100px] transition-all duration-500 ease-out hover:-translate-y-2 ${config.width}`}
                    >
                        {/* Avatar Group - Consistent Size */}
                        <div className="relative mb-4 flex flex-col items-center">
                            {isFirst && (
                                <Crown className="absolute -top-10 w-10 h-10 text-yellow-500 fill-yellow-400 animate-bounce" />
                            )}
                            
                            {/* Avatar Container: Square with rounded corners */}
                            <div className={`
                                w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden
                                border-4 bg-white dark:bg-slate-800 shadow-xl
                                ${entry.rank === 1 ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 
                                  entry.rank === 2 ? 'border-gray-300' : 'border-amber-600'}
                            `}>
                                {userProfile ? (
                                    <div className="transform scale-[0.65] origin-center -mt-2">
                                        <ProfileAvatar 
                                            profileData={userProfile}
                                            itemsData={itemsData}
                                        />
                                    </div>
                                ) : (
                                    <User className={`w-14 h-14 ${
                                        entry.rank === 1 ? 'text-yellow-600' : 
                                        entry.rank === 2 ? 'text-gray-500' : 'text-amber-700'
                                    }`} />
                                )}
                            </div>

                            <div className={`
                                absolute -bottom-3 px-3 py-0.5 rounded-full text-xs font-bold shadow-lg
                                ${config.badge}
                            `}>
                                #{entry.rank}
                            </div>
                        </div>

                        {/* Podium Block */}
                        <Card className={`
                            w-full ${config.height} rounded-t-xl rounded-b-none border-t-[6px] border-x-0 border-b-0
                            ${config.color} ${config.border} shadow-2xl relative overflow-hidden group
                            flex flex-col items-center pt-8 pb-4
                        `}>
                            {/* Shine effect */}
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-white opacity-10 blur-xl rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-700" />

                            {/* User Content */}
                            <div className="flex flex-col items-center w-full px-3 z-10 text-white h-full">
                                <Link 
                                    href={`/kkuko/profile?nick=${encodeURIComponent(entry.userInfo.nickname)}`}
                                    className={`font-bold hover:underline decoration-white/50 text-center truncate max-w-full mb-1 ${config.textGlow} ${isFirst ? 'text-2xl' : 'text-xl'}`}
                                >
                                    {entry.userInfo.nickname}
                                </Link>
                                
                                <span className={`text-sm font-medium opacity-90 mb-6 ${config.textGlow}`}>
                                    Lv.{entry.userInfo.level}
                                </span>

                                {/* Stats box */}
                                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 w-full max-w-[160px] border border-white/10 mb-4">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5" />
                                            <span className="font-bold text-base">
                                                {option === 'exp' 
                                                    ? entry.userRecord.exp.toLocaleString()
                                                    : entry.userRecord.win.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-xs opacity-90 font-medium">
                                            {entry.userRecord.total.toLocaleString()}전 / 승률 {winRate(entry)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Exordial (User Status Message) */}
                                {entry.userInfo.exordial && (
                                    <div className="mt-auto mb-4 px-2 text-center w-full">
                                        <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                                            <p className="text-xs italic text-white/90 line-clamp-3 font-medium break-keep">
                                                &quot;{entry.userInfo.exordial}&quot;
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                );
            })}
        </div>
    );
}
