'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/src/app/components/ui/button';
import { useWordDeletion } from '@/src/modules/word-moderation';

import WordDeletionPanel from './WordDeletionPanel';

export default function DelWordsHome() {
    const deletion = useWordDeletion();

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">단어 대량 삭제 페이지</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">단어를 대량으로 삭제합니다.</p>
            </header>
            <main className="flex-grow">
                <Link href="/admin" className="mb-4 flex">
                    <Button variant="outline">
                        <ArrowLeft />
                        관리자 대시보드로 이동
                    </Button>
                </Link>
                <WordDeletionPanel deletion={deletion} />
            </main>
        </div>
    );
}
