import React from 'react';
import { ItemInfo, ProfileData, isSpecialOptions, ItemOption, SpecialOptions } from '@/types/kkuko.types';
import TryRenderImg from '../../shared/components/TryRenderImg'
import { getSlotName, extractColorFromLabel, parseDescription, getOptionName, formatNumber } from '../utils/profileHelper';
import { NICKNAME_COLORS } from '../../shared/lib/const';

interface ItemModalProps {
    itemsData: ItemInfo[];
    profileData: ProfileData | null;
    onClose: () => void;
}

export default function ItemModal({ itemsData, profileData, onClose }: ItemModalProps) {
    const isDarkTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;

    const itemOptionsUI = (options: ItemOption | SpecialOptions) => {
        const itemOptionUI = (key: string, value: number) => (
            <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded px-3 py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{getOptionName(key)}: </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{value > 0 ? '+' : ''}{formatNumber(value * (key[0] === 'g' ? 100 : 1))}{key[0] === 'g' ? '%p' : ''}</span>
            </div>
        )

        if (isSpecialOptions(options)) {
            const relevantOptions = Date.now() >= options.date ? options.after : options.before;
            return Object.entries(relevantOptions).filter(([_, v]) => v !== undefined && typeof v === 'number').map(([k, v]) =>
                itemOptionUI(k, v as number)
            );
        } else {
            return Object.entries(options).filter(([_, v]) => v !== undefined && typeof v === 'number').map(([k, v]) =>
                itemOptionUI(k, v as number)
            );
        }
    }

    const itemImgPlaceholder = () => (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-400 dark:text-gray-500 text-center">아이템<br />이미지</span>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-30">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">장착 아이템 목록</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
                    >
                        ×
                    </button>
                </div>
                <div className="p-6 space-y-4 relative">
                    {itemsData.map((item) => {
                        const equipment = profileData?.equipment.find(eq => eq.itemId === item.id);
                        const slotName = equipment ? getSlotName(equipment.slot) : '알 수 없음';
                        const isNikItem = equipment?.slot === 'NIK';
                        const nikColor = isNikItem ? extractColorFromLabel(item.description, isDarkTheme) : undefined;

                        // Get the image group from equipment slot
                        const getImageGroup = () => {
                            if (!equipment) return null;
                            if (equipment.slot === 'NIK') return null; // No image for nickname items
                            if (equipment.slot === 'BDG' || equipment.slot === 'pbdg') return 'badge';
                            if (equipment.slot.startsWith('Ml') || equipment.slot.startsWith('Mr')) return 'hand';
                            // Remove 'M' prefix from slot name (e.g., 'Mavatar' -> 'avatar')
                            return equipment.slot.startsWith('M') ? equipment.slot.substring(1).toLowerCase() : equipment.slot.toLowerCase();
                        };

                        const imageGroup = getImageGroup();

                        return (
                            <div key={`${item.id}::${equipment?.slot}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex gap-4">
                                    {/* Item Image */}
                                    {imageGroup && (
                                        <div className="relative w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            <TryRenderImg
                                                placeholder={itemImgPlaceholder()}
                                                url={`/api/kkuko/image?url=https://cdn.kkutu.co.kr/img/kkutu/moremi/${imageGroup}/${item.id}.png`}
                                                alt={item.name}
                                                width={80}
                                                height={80}
                                                className="transition-opacity duration-300"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4
                                                className="font-bold text-lg"
                                                style={isNikItem ? { color: nikColor } : {}}
                                            >
                                                {item.name}
                                            </h4>
                                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                                {slotName}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                                            {parseDescription(item.description).map((part, i) => (
                                                <span key={i} style={{ color: part.colorKey ? (NICKNAME_COLORS[part.colorKey] || (isDarkTheme ? '#FFFFFF' : '#000000')) : undefined }}>
                                                    {part.text}
                                                </span>
                                            ))}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {itemOptionsUI(item.options)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
