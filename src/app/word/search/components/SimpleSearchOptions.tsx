import { Search, Loader2 } from 'lucide-react';
import React from "react";

interface SimpleSearchOptionsProps {
    simpleQuery: string;
    setSimpleQuery: (v: string) => void;
    loading: boolean;
    handleSearch: () => void;
}

export default function SimpleSearchOptions({
    simpleQuery,
    setSimpleQuery,
    loading,
    handleSearch,
}: SimpleSearchOptionsProps) {
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={simpleQuery}
                    onChange={(e) => setSimpleQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="검색할 단어를 입력하세요"
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    검색
                </button>
            </div>
        </div>
    );
}
