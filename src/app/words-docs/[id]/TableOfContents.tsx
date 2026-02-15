"use client"
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TocItem {
    title: string;
    index: number;
}

interface TocProps {
    items: TocItem[];
    onItemClick: (index: number) => void;
    isSp?: boolean; // 특수 ToC처리 용도
}

const TableOfContents = ({ items, onItemClick, isSp = false }: TocProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // 초성 리스트 (ㄱ과 ㄲ, ㄷ과 ㄸ 등은 같은 그룹으로 묶기 위함)
    const CHOSEONG_GROUP_MAP: Record<string, string> = {
        'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ',
        'ㄴ': 'ㄴ',
        'ㄷ': 'ㄷ', 'ㄸ': 'ㄷ',
        'ㄹ': 'ㄹ',
        'ㅁ': 'ㅁ',
        'ㅂ': 'ㅂ', 'ㅃ': 'ㅂ',
        'ㅅ': 'ㅅ', 'ㅆ': 'ㅅ',
        'ㅇ': 'ㅇ',
        'ㅈ': 'ㅈ', 'ㅉ': 'ㅈ',
        'ㅊ': 'ㅊ',
        'ㅋ': 'ㅋ',
        'ㅌ': 'ㅌ',
        'ㅍ': 'ㅍ',
        'ㅎ': 'ㅎ'
    };

    const CHOSEONG_ORDER = [
        'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ',
        'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    function getChoseongGroup(char: string): string {
        const code = char.charCodeAt(0);
        if (code < 0xac00 || code > 0xd7a3) return '기타';

        const uni = code - 0xac00;
        const choseongIndex = Math.floor(uni / (21 * 28));
        const choseongList = [
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ',
            'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ',
            'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
        ];
        const rawChoseong = choseongList[choseongIndex];
        return CHOSEONG_GROUP_MAP[rawChoseong] ?? '기타';
    }

    // 그룹화 및 정렬된 데이터 생성
    const groupedItems = useMemo(() => {
        if (isSp) {
            return [{
                group: "",
                items
            }];
        }

        const grouped = items.reduce((acc, item) => {
            const group = getChoseongGroup(item.title[0]);
            if (!acc[group]) acc[group] = [];
            acc[group].push(item);
            return acc;
        }, {} as Record<string, TocItem[]>);

        for (const group in grouped) {
            grouped[group].sort((a, b) =>
                a.title.localeCompare(b.title, 'ko')
            );
        }

        const orderedGroups = CHOSEONG_ORDER.filter(group => grouped[group]);

        return orderedGroups.map(group => ({
            group,
            items: grouped[group]
        }));
    }, [items, isSp]);



    const displayItems = groupedItems;


    const handleItemClick = (index: number) => {
        onItemClick(index);
    };

    return (
        <div className="w-full max-w-full p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg transition-colors duration-300">
            <div className="flex justify-between items-center mb-2">
                <button
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none flex items-center space-x-1 transition-colors duration-200"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="text-sm">{isOpen ? "[접기]" : "[펼치기]"}</span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>
            <hr className="mb-4 border-gray-300 dark:border-gray-700" />

            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                    height: isOpen ? "auto" : 0,
                    opacity: isOpen ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
            >
                <div className="max-h-80 overflow-y-auto pr-2 space-y-4">
                    {displayItems.map(({ group, items: groupItems }) => (
                        <div key={group} className="mb-4">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2 text-lg border-b border-gray-200 dark:border-gray-700 pb-1">
                                {group}
                            </h3>
                            <div className="flex flex-wrap gap-2 ml-2">
                                {groupItems.map((item) => (
                                    <button
                                        key={item.index}
                                        className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-200 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                                        onClick={() => handleItemClick(item.index)}
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default TableOfContents;