"use client";

import Table from "./Table";
import type { WordData } from "@/app/types/type";
import { useState, lazy, Suspense, memo } from "react";
import { motion } from "framer-motion";
import { useSelector } from 'react-redux';
import { RootState } from "@/app/store/store";
import Spinner from "@/app/components/Spinner";

const WordAddModal = lazy(() => import("./WordAddModal"));

const WordsTableBody = ({
    title,
    initialData,
    isMission,
    isLong,
    isSp
}: { initialData: WordData[]; title: string, isMission: boolean, isLong: boolean, isSp?: {m: string} }) => {
    const [wordAddModalOpen, setWordAddModalOpen] = useState(false);
    const [isTableVisible, setIsTableVisible] = useState(true);

    const user = useSelector((state: RootState) => state.user);

    return (
        <div className="w-full mx-auto py-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm">
            {/* 제목 표시 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-left text-gray-900 dark:text-gray-100">{title}</h1>

                <button
                    className="px-3 py-1 text-sm text-white bg-purple-500 hover:bg-purple-600 rounded"
                    onClick={() => setIsTableVisible(!isTableVisible)}
                >
                    {isTableVisible ? "접기" : "펼치기"}
                </button>

                {/* 단어 추가 버튼 (로그인 필요) */}
                {user.uuid && (
                    <button
                        className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
                        onClick={() => setWordAddModalOpen(true)}
                    >
                        추가
                    </button>
                )}
            </div>

            {/* 단어 테이블 */}
            <motion.div
                initial={false}
                animate={{ height: isTableVisible ? "auto" : 0, opacity: isTableVisible ? 1 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
            >
                <Table initialData={initialData} isMission={isMission ? {m: true, t: title} : isSp ? {m: true, t: isSp.m} : {m: false, t: null}} isLong={isLong}/>
            </motion.div>

            {/* 단어 추가 모달 */}
            {wordAddModalOpen && (
                <Suspense fallback={
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-lg">
                        <Spinner />
                    </div>
                }>
                    <WordAddModal
                        isOpen={wordAddModalOpen}
                        onClose={() => setWordAddModalOpen(false)}
                    />
                </Suspense>
            )}

            <hr className="mt-3 border-gray-300 dark:border-gray-700" />
        </div>

    );
};

export default memo(WordsTableBody);
