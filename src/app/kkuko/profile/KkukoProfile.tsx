'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { useKkukoProfile } from './hooks/useKkukoProfile';
import ProfileSearch from './components/ProfileSearch';
import ProfileHeader from './components/ProfileHeader';
import ProfileStats from './components/ProfileStats';
import ProfileRecords from './components/ProfileRecords';
import ItemModal from './components/ItemModal';
import ErrorModal from '../../components/ErrModal';
import CompleteModal from '../../components/CompleteModal';
import FailModal from '../../components/FailModal';
import ConfirmModal from '../../components/ConfirmModal';

export default function KkukoProfile() {
    const searchParams = useSearchParams();
    const {
        profileData,
        profileList,
        itemsData,
        modesData,
        loading,
        error,
        detailedError,
        setDetailedError,
        totalUserCount,
        expRank,
        recentSearches,
        fetchProfile,
        removeFromRecentSearches,
        selectProfile,
        requestForceRefresh
    } = useKkukoProfile();

    const [showItemModal, setShowItemModal] = useState(false);
    
    // Modal state for force refresh
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showFailModal, setShowFailModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshRequest = () => {
        if (isRefreshing) return;
        setShowConfirmModal(true);
    };

    const handleConfirmRefresh = async () => {
        setShowConfirmModal(false);
        setIsRefreshing(true);
        if (!profileData?.user?.id) return;

        try {
            await requestForceRefresh(profileData.user.id);
            setShowCompleteModal(true);
        } catch (error: unknown) {
            console.error('Refresh error:', error);
            setModalMessage('알 수 없는 오류가 발생했습니다.');
            setShowFailModal(true);
        } finally {
            setIsRefreshing(false);
        }
    };


    // Handle URL query parameters to trigger fetch
    useEffect(() => {
        const nick = searchParams.get('nick');
        const id = searchParams.get('id');

        if (nick) {
            fetchProfile(nick, 'nick');
        } else if (id) {
            fetchProfile(id, 'id');
        }
    }, [searchParams, fetchProfile]);

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Title Section */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                끄투코리아 유저 조회 {totalUserCount > 0 && `(등록된 유저수 ${totalUserCount.toLocaleString()})`}
            </h1>

            {/* Search Section */}
            <ProfileSearch 
                loading={loading}
                recentSearches={recentSearches}
                onRemoveRecentSearch={removeFromRecentSearches}
                onSearch={fetchProfile}
            />

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">로딩 중...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-700 dark:text-red-400 font-semibold">{error}</p>
                    <p className="text-red-600 dark:text-red-500 text-sm mt-2">
                        2026-01-18 17시 ~ 2026-03-03 00시 사이에 게임 접속한 유저에 대해서 조회할 수 있습니다.
                        프로필 등록을 원하신다면 id검색을 이용해주세요.
                    </p>
                </div>
            )}

            {/* List Selection */}
            {!profileData && profileList && !loading && (
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">검색 결과 선택</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        여러 유저가 검색되었습니다. 조회할 유저를 선택해주세요.
                    </p>
                    <ul className="space-y-2">
                        {profileList.map((profile) => (
                             <li key={profile.user.id} 
                                 className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                                 onClick={() => selectProfile(profile)}
                             >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{profile.user.nickname}</span>
                                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                                            Lv. {profile.user.level}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        ID: {profile.user.id}
                                    </div>
                                </div>
                             </li>
                        ))}
                    </ul>
                 </div>
            )}

            {/* Empty State - No search yet AND No List */}
            {!loading && !error && !profileData && !profileList && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
                    <div className="max-w-md mx-auto">
                        <Search className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            유저 검색
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            닉네임 또는 ID로 끄투코리아 유저의 프로필을 조회할 수 있습니다.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                            <p className="text-sm text-blue-700 dark:text-blue-400 font-semibold mb-2">📌 안내</p>
                            <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                                <li>• 2026-01-18 17시 이후 게임 접속한 유저만 조회 가능합니다</li>
                                <li>• 검색 후 최근 검색 기록이 표시됩니다</li>
                                <li>• 실시간 접속 상태와 게임 전적을 확인할 수 있습니다</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Data */}
            {profileData && !loading && (
                <div className="space-y-6">
                    {/* User Profile Section */}
                    <ProfileHeader 
                        profileData={profileData}
                        itemsData={itemsData}
                        expRank={expRank}
                        isRefreshing={isRefreshing}
                        onRefreshRequest={handleRefreshRequest}
                    />

                    {/* Equipment Section */}
                    <ProfileStats 
                        itemsData={itemsData}
                        onShowDetail={() => setShowItemModal(true)}
                    />


                    {/* Records Section */}
                    <ProfileRecords 
                        profileData={profileData}
                        modesData={modesData}
                    />
                </div>
            )}

            {/* Item Modal */}
            {showItemModal && (
                <ItemModal 
                    itemsData={itemsData}
                    profileData={profileData}
                    onClose={() => setShowItemModal(false)}
                />
            )}

            {/* Error Modal */}
            {detailedError && (
                <ErrorModal 
                    error={detailedError} 
                    onClose={() => setDetailedError(null)} 
                />
            )}

            {/* Force Refresh Modals */}
            <CompleteModal
                open={showCompleteModal}
                onClose={() => setShowCompleteModal(false)}
                title="갱신 요청 완료"
                description="갱신 요청이 완료되었습니다. 잠시 후 새로고침 해주세요."
            />

            <FailModal
                open={showFailModal}
                onClose={() => setShowFailModal(false)}
                title="갱신 요청 실패"
                description={modalMessage}
            />

            {/* Warning Message */}
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 text-center">
                    ⚠️ 해당 데이터는 비공식 API를 사용하여 만들었으며 데이터가 항상 최신이거나 정확하다고 할 수 없습니다. 참고용으로만 사용해주세요.
                </p>
            </div>

            {/* Force Refresh Modals */}
            <ConfirmModal
                open={showConfirmModal}
                title="정보 강제 갱신"
                description="정보를 강제로 갱신하시겠습니까? (약 1분 소요)"
                onConfirm={handleConfirmRefresh}
                onClose={() => setShowConfirmModal(false)}
            />

            <CompleteModal
                open={showCompleteModal}
                onClose={() => setShowCompleteModal(false)}
                title="갱신 요청 완료"
                description="갱신 요청이 완료되었습니다. 잠시 후 새로고침 해주세요."
            />

            <FailModal
                open={showFailModal}
                onClose={() => setShowFailModal(false)}
                title="갱신 요청 실패"
                description={modalMessage}
            />
        </div>
    );
}