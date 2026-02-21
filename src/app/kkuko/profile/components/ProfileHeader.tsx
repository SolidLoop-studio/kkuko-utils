'use client';

import React from 'react';
import Link from 'next/link';
import { ItemInfo, ProfileData } from '@/src/app/types/kkuko.types';
import TryRenderImg from '../../shared/components/TryRenderImg';
import ProfileAvatar from '../../shared/components/ProfileAvatar';
import { formatLastSeen, formatObservedAt, getNicknameStyle } from '../utils/profileHelper';

interface ProfileHeaderProps {
    profileData: ProfileData;
    itemsData: ItemInfo[];
    expRank: number | null;
    isRefreshing: boolean;
    onRefreshRequest: () => void;
}

export default function ProfileHeader({ 
    profileData, 
    itemsData, 
    expRank, 
    isRefreshing,
    onRefreshRequest 
}: ProfileHeaderProps) {
    const isDarkTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;

    const lvImgPlaceholder = () => (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center z-10">
            <span className="text-xs text-gray-400 dark:text-gray-500">Lv</span>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex gap-6">
                {/* Left: Character Image and Badges */}
                <div className="flex flex-col gap-3 flex-shrink-0">
                    <ProfileAvatar profileData={profileData} itemsData={itemsData} />

                    {/* Badges (pbdg slot items) */}
                    {profileData.equipment.filter(eq => eq.slot === 'pbdg').length > 0 && (
                        <div className="flex flex-wrap gap-2 w-48">
                            {profileData.equipment
                                .filter(eq => eq.slot === 'pbdg')
                                .map(eq => {
                                    const item = itemsData.find(i => i.id === eq.itemId);
                                    if (!item) return null;
                                    return (
                                        <div
                                            key={eq.itemId}
                                            className="relative group"
                                            title={item.name}
                                        >
                                            <div className="relative w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                                                <TryRenderImg
                                                    placeholder={<div className="w-10 h-10" />}
                                                    url={`https://api.solidloop-studio.xyz/kkuko/img?url=https://cdn.kkutu.co.kr/img/kkutu/moremi/badge/${item.id}.png`}
                                                    alt={item.name}
                                                    width={40}
                                                    height={40}
                                                    className="transition-opacity duration-300"
                                                />
                                            </div>
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                {item.name}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Right: User Info */}
                <div className="flex-1 space-y-3">
                    <div>
                        <h2
                            className="text-3xl font-bold"
                            style={getNicknameStyle(profileData.equipment, isDarkTheme)}
                        >
                            {profileData.user.nickname}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{profileData.user.exordial}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ID: {profileData.user.id}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">경험치</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{profileData.user.exp.toLocaleString()} EXP</p>
                            {expRank !== null && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">경험치 랭킹: #{expRank.toLocaleString()}</p>
                            )}
                        </div>

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">레벨</p>
                            <div className="flex items-center gap-2">
                                <div className="relative w-8 h-8 flex-shrink-0">
                                    <TryRenderImg
                                        placeholder={lvImgPlaceholder()}
                                        url={`https://api.solidloop-studio.xyz/kkuko/img?url=https://cdn.kkutu.co.kr/img/kkutu/lv/lv${String(profileData.user.level).padStart(4, '0')}.png`}
                                        alt="Level Icon"
                                        width={32}
                                        height={32}
                                        className={`rounded transition-opacity duration-300`}
                                    />
                                </div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Lv. {profileData.user.level}
                                </p>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">정보 갱신 시각</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatObservedAt(profileData.user.observedAt)}</p>
                        </div> 

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">접속 상태</p>
                            <p className="text-lg font-semibold">
                                {profileData.presence.channelId ? (
                                    <span className="text-green-600 dark:text-green-400">온라인</span>
                                ) : (
                                    <span className="text-gray-500 dark:text-gray-400">오프라인</span>
                                )}
                            </p>
                            {profileData.presence.channelId ? (
                                <p className="text-xs text-gray-600 dark:text-gray-400">채널: {profileData.presence.channelId}</p>
                            ) : (
                                profileData.presence.updatedAt !== null ?
                                <p className="text-xs text-gray-600 dark:text-gray-400">마지막 접속: {formatLastSeen(profileData.presence.updatedAt)}</p> :
                                null
                            )}
                        </div>

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">방 정보</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {profileData.presence.roomId ? (
                                    <span>방 {profileData.presence.roomId}</span>
                                ) : (
                                    <span className="text-gray-400 dark:text-gray-500">미입장</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end mt-1 items-center gap-3">
                        <button
                            onClick={onRefreshRequest}
                            disabled={isRefreshing}
                            className={`text-xs ${isRefreshing ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-400 dark:text-gray-500 hover:underline'}`}
                        >
                            {isRefreshing ? '갱신 요청 중...' : '정보 강제 갱신'}
                        </button>
                        <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                        <Link href="/notification/9" className="text-xs text-gray-400 dark:text-gray-500 hover:underline">
                            정보 비공개 요청
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
