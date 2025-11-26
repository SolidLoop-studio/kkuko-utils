import { useRef } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BookOpen, ArrowRight, Search, Loader2 } from 'lucide-react';
import { GameMode, SearchResult } from '../types';
import { countMissionChars } from '../utils';

interface SearchResultsProps {
    results: SearchResult[];
    searchPerformed: boolean;
    loading: boolean;
    mission: string;
    miniInfo: boolean;
    mode: GameMode;
}

export default function SearchResults({
    results,
    searchPerformed,
    loading,
    mission,
    miniInfo,
    mode
}: SearchResultsProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: results.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => (miniInfo ? 80 : 64),
        overscan: 5,
    });

    const handleResultDownload = () => {
        const blob = new Blob([results.map(({word})=>word).join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'results.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    const highlightMission = (word: string, missionChars: string) => {
        if (!missionChars) return word;
        
        const chars = word.split('');
        return chars.map((char, idx) => {
            if (missionChars.includes(char)) {
                return <span key={idx} className="text-lime-500 font-bold">{char}</span>;
            }
            return char;
        });
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 rounded-t-xl flex-shrink-0">
                <h2 className="font-medium text-lg text-gray-700 dark:text-gray-200">
                    검색 결과 {searchPerformed && results.length > 0 ? `(${results.length}개)` : ''}
                </h2>
                <button 
                    onClick={handleResultDownload}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                    결과 다운로드
                </button>
            </div>
            
            <div 
                ref={parentRef}
                className="flex-1 overflow-y-auto overflow-x-hidden"
                style={{ height: '100%' }}
            >
                {!searchPerformed ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center py-12">
                            <Search className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">검색 조건을 설정하고 검색하세요</p>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center items-center h-full py-12">
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                        <span className="ml-2 text-gray-600 dark:text-gray-300">검색 중...</span>
                    </div>
                ) : results.length > 0 ? (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                            const word = results[virtualItem.index];
                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                                        <div className="flex items-center flex-1">
                                            <BookOpen className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="text-gray-800 dark:text-gray-100 font-medium">
                                                    {highlightMission(word.word, mission)}
                                                </span>
                                                {miniInfo && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        길이: {word.word.length}글자
                                                        {mission && countMissionChars(word.word, mission) > 0 && (
                                                            <> · 미션글자 포함: {countMissionChars(word.word, mission)}개</>
                                                        )}
                                                        {(mode !== "hunmin" && mode !== "jaqi" ) && <> · 후속 단어 수: {word.nextWordCount}</>}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Link 
                                            href={`/word/search/${word.word}`}
                                            className="ml-4 flex items-center px-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-gray-700 dark:text-gray-200 font-medium flex-shrink-0"
                                        >
                                            상세보기
                                            <ArrowRight className="ml-1 h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="py-12 text-center">
                            <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">다른 검색 조건으로 시도해보세요</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
