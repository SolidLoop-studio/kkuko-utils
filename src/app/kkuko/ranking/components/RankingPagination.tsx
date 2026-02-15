'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/src/app/components/ui/button';

interface RankingPaginationProps {
    currentPage: number;
    onPageChange: (page: number) => void;
    hasNextPage: boolean;
}

export function RankingPagination({ currentPage, onPageChange, hasNextPage }: RankingPaginationProps) {
    return (
        <div className="flex items-center justify-center gap-4 mt-8">
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
                <span className="text-gray-900 dark:text-white font-semibold">{currentPage}</span>
                <span className="text-gray-600 dark:text-gray-400">페이지</span>
            </div>
            
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!hasNextPage}
                className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
