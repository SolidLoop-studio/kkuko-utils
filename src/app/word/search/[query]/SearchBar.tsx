'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useWordSuggestions } from '@/src/modules/word-catalog';

// 검색창 컴포넌트 (WordInfo 컴포넌트 내부에 추가)
const WordSearchBar = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [committedQuery, setCommittedQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const suggestionsQuery = useWordSuggestions(committedQuery);
    const searchResults = suggestionsQuery.data ?? [];
    const isLoading = suggestionsQuery.isFetching;

    // 검색어 변경 처리
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        setCommittedQuery('');
        setIsSearchOpen(false);
    };

    // 검색 버튼 클릭 또는 엔터 입력 시 검색 실행
    const handleSearchSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        setIsSearchOpen(true);
        setCommittedQuery(searchQuery.trim());
    };

    // 검색 결과 클릭 처리
    const handleResultClick = () => {
        setIsSearchOpen(false);
        setSearchQuery('');
        setCommittedQuery('');
    };

    // 검색창 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (suggestionsQuery.error) {
            console.error('검색 오류:', suggestionsQuery.error);
        }
    }, [suggestionsQuery.error]);

    return (
        <div className="max-w-4xl mx-auto mb-6" ref={searchRef}>
            <div className="relative">
                {/* 검색 입력창 */}
                <div className="relative">
                    {/* 검색 입력창 */}
                <form
                    className="relative"
                    onSubmit={handleSearchSubmit}
                >
                    <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 cursor-pointer"
                        size={20}
                        onClick={handleSearchSubmit}
                        tabIndex={0}
                        aria-label="검색"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleInputChange}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="단어를 검색하세요..."
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                                 placeholder-gray-500 dark:placeholder-gray-400
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                 shadow-sm hover:shadow-md transition-shadow duration-200"
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSearchSubmit(e);
                        }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setCommittedQuery('');
                                setIsSearchOpen(false);
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={20} />
                        </button>
                    )}
                    </form>
                </div>

                {/* 검색 결과 드롭다운 */}
                {isSearchOpen && (searchQuery || isLoading) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    검색 중...
                                </div>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="py-2">
                                {searchResults.map((word, index) => (
                                    <Link
                                        key={index}
                                        href={`/word/search/${word}`}
                                        onClick={handleResultClick}
                                        className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Search size={16} className="text-gray-400 dark:text-gray-500" />
                                            {word}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : searchQuery && (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// WordInfo 컴포넌트의 return 문에서 사용할 JSX
export default WordSearchBar;
