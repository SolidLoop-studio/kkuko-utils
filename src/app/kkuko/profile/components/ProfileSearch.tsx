'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchHistoryItem } from '../hooks/useRecentSearches';
import { normalizeHangul } from '@/src/app/lib/hangulUtils';

interface ProfileSearchProps {
    loading: boolean;
    recentSearches: SearchHistoryItem[];
    onRemoveRecentSearch: (query: string, type: 'nick' | 'id') => void;
    onSearch: (query: string, type: 'nick' | 'id') => void;
}

export default function ProfileSearch({ loading, recentSearches, onRemoveRecentSearch, onSearch }: ProfileSearchProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'nick' | 'id'>('nick');
    const [showDropdown, setShowDropdown] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync input with query params
    useEffect(() => {
        const nick = searchParams.get('nick');
        const id = searchParams.get('id');

        if (nick) {
            setSearchQuery(nick);
            setSearchType('nick');
            // We assume parent handles the actual fetch via its own effect or we call onSearch here?
            // Since the hook in parent reads useSearchParams, we DON'T need to call onSearch here.
            // Just update UI state.
        } else if (id) {
            setSearchQuery(id);
            setSearchType('id');
        }
    }, [searchParams]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        const trimmed = searchQuery.trim();
        // Call parent fetch immediately so UI shows loading without waiting for navigation
        onSearch(trimmed, searchType);

        const queryParam = searchType === 'nick' ? 'nick' : 'id';
        // update URL without adding a history entry
        router.replace(`/kkuko/profile?${queryParam}=${encodeURIComponent(trimmed)}`);
        setShowDropdown(false);
    };

    const handleRecentSearchClick = (search: SearchHistoryItem) => {
        setSearchQuery(search.query);
        setSearchType(search.type);
        // call parent fetch immediately to reduce perceived latency
        onSearch(search.query, search.type);
        const queryParam = search.type === 'nick' ? 'nick' : 'id';
        router.replace(`/kkuko/profile?${queryParam}=${encodeURIComponent(search.query)}`);
        setShowDropdown(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getFilteredSearches = () => {
        if (!searchQuery.trim()) {
            return recentSearches;
        }

        const normalizedQuery = normalizeHangul(searchQuery);

        return recentSearches.filter(search => {
            if (search.type !== searchType) return false;

            const normalizedTarget = normalizeHangul(search.query);
            return normalizedTarget.startsWith(normalizedQuery);
        });
    };

    return (
        <div className="mb-8 relative">
            <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="유저 검색..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {/* Dropdown */}
                    {showDropdown && recentSearches.length > 0 && getFilteredSearches().length > 0 && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
                        >
                            <div className="py-2">
                                <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                    최근 검색
                                </div>
                                {getFilteredSearches().map((search, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
                                    >
                                        <button
                                            onClick={() => handleRecentSearchClick(search)}
                                            className="flex-1 text-left flex items-center gap-2"
                                        >
                                            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            <span className="text-gray-900 dark:text-gray-100">{search.query}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">({search.type === 'nick' ? '닉네임' : 'ID'})</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveRecentSearch(search.query, search.type);
                                            }}
                                            className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as 'nick' | 'id')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="nick">닉네임</option>
                    <option value="id">ID</option>
                </select>
                <button
                    onClick={handleSearch}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={loading}
                >
                    <Search className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
