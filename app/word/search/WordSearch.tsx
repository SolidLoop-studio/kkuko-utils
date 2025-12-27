'use client';

import { useState } from 'react';
import { useWordSearch } from './hooks/useWordSearch';
import SearchHeader from './components/SearchHeader';
import SearchOptions from './components/SearchOptions';
import SimpleSearchOptions from './components/SimpleSearchOptions';
import SearchResults from './components/SearchResults';
import ModeSelectionModal from './components/ModeSelectionModal';
import ThemeSelectionModal from './components/ThemeSelectionModal';

export default function WordSearch() {
    const [showModeModal, setShowModeModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showOptions, setShowOptions] = useState(true);

    const {
        searchType, setSearchType,
        mode, setMode,
        results, setResults,
        loading,
        searchPerformed, setSearchPerformed,
        startLetter, setStartLetter,
        endLetter, setEndLetter,
        mission, setMission,
        minLength, setMinLength,
        maxLength, setMaxLength,
        sortBy, setSortBy,
        duem, setDuem,
        miniInfo, setMiniInfo,
        manner, setManner,
        ingjung, setIngjung,
        simpleQuery, setSimpleQuery,
        displayLimit, setDisplayLimit,
        selectedTheme, setSelectedTheme,
        handleSearch,
        handleSimpleSearch
    } = useWordSearch();

    const handleSearchTypeChange = (type: 'simple' | 'advanced') => {
        setSearchType(type);
        setSearchPerformed(false);
        setResults([]);
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 p-4">
            <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0">
                <div className="flex justify-end md:hidden mb-2">
                    <button
                        onClick={() => setShowOptions((v) => !v)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md"
                    >
                        {showOptions ? '검색 옵션 숨기기' : '검색 옵션 보기'}
                    </button>
                </div>

                {/* 제목 및 검색 타입, 검색 옵션 */}
                {showOptions && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 mb-4">
                        <SearchHeader
                            searchType={searchType}
                            setSearchType={handleSearchTypeChange}
                            mode={mode}
                            onOpenModeModal={() => setShowModeModal(true)}
                        />

                        <div className="mt-3">
                            {searchType === 'simple' ? (
                                <SimpleSearchOptions
                                    simpleQuery={simpleQuery}
                                    setSimpleQuery={setSimpleQuery}
                                    loading={loading}
                                    handleSearch={handleSimpleSearch}
                                />
                            ) : (
                                <SearchOptions
                                    mode={mode}
                                    startLetter={startLetter} setStartLetter={setStartLetter}
                                    endLetter={endLetter} setEndLetter={setEndLetter}
                                    mission={mission} setMission={setMission}
                                    minLength={minLength} setMinLength={setMinLength}
                                    maxLength={maxLength} setMaxLength={setMaxLength}
                                    sortBy={sortBy} setSortBy={setSortBy}
                                    duem={duem} setDuem={setDuem}
                                    miniInfo={miniInfo} setMiniInfo={setMiniInfo}
                                    manner={manner} setManner={setManner}
                                    ingjung={ingjung} setIngjung={setIngjung}
                                    simpleQuery={simpleQuery} setSimpleQuery={setSimpleQuery}
                                    displayLimit={displayLimit} setDisplayLimit={setDisplayLimit}
                                    loading={loading}
                                    handleSearch={handleSearch}
                                    onOpenThemeModal={() => setShowThemeModal(true)}
                                    selectedTheme={selectedTheme}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* 검색 결과 */}
                <div className="flex-1 overflow-auto min-h-0">
                    <SearchResults
                        results={results}
                        searchPerformed={searchPerformed}
                        loading={loading}
                        mission={mission}
                        miniInfo={miniInfo}
                        mode={mode}
                    />
                </div>
            </div>

            {/* 모드 선택 모달 */}
            <ModeSelectionModal
                isOpen={showModeModal}
                onClose={() => setShowModeModal(false)}
                currentMode={mode}
                onSelectMode={(m) => {
                    setMode(m);
                    setShowModeModal(false);
                    setSearchPerformed(false);
                    setResults([]);
                    if (m === 'kung') {
                        setMinLength(3);
                        setMaxLength(3);
                        if (sortBy === 'length') setSortBy('abc');
                    }
                }}
            />

            {/* 주제 선택 모달 */}
            <ThemeSelectionModal
                isOpen={showThemeModal}
                onClose={() => setShowThemeModal(false)}
                selectedTheme={selectedTheme}
                onSelectTheme={(theme) => setSelectedTheme(theme)}
            />
        </div>
    );
}
