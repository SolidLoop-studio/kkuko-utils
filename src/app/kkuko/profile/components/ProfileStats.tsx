import React from 'react';
import { ItemInfo } from '@/src/app/types/kkuko.types';
import { calculateTotalOptions, getOptionName, formatNumber } from '../utils/profileHelper';

interface ProfileStatsProps {
    itemsData: ItemInfo[];
    onShowDetail: () => void;
}

export default function ProfileStats({ itemsData, onShowDetail }: ProfileStatsProps) {
    const totalOptions = calculateTotalOptions(itemsData);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">착용 아이템 정보</h3>
                <button
                    onClick={onShowDetail}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    보기
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(totalOptions).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{getOptionName(key)}</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value > 0 ? '+' : ''}{formatNumber(value)}{key[0] === 'g' ? '%p' : ''}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
