import { Equipment, ItemInfo, KkukoRecord, Mode, isSpecialOptions } from '@/types/kkuko.types';
import { NICKNAME_COLORS, OPTION_NAMES, SLOT_NAMES } from '../../shared/lib/const';
import { CSSProperties } from 'react';

export const getNicknameColor = (equipment: Equipment[], isDarkTheme: boolean): string => {
    const nikItem = equipment.find(eq => eq.slot === 'NIK');
    const defaultColor = isDarkTheme ? '#FFFFFF' : '#000000';
    
    if (!nikItem) return defaultColor;

    const colorKey = nikItem.itemId.toLowerCase().replace('_name', '');
    return NICKNAME_COLORS[colorKey] || defaultColor;
};

export const getNicknameStyle = (equipment: Equipment[], isDarkTheme: boolean): CSSProperties => {
    const nikItem = equipment.find(eq => eq.slot === 'NIK');

    if (nikItem?.itemId === '25_815_blue_red_name') {
        return {
            background: 'linear-gradient(127deg,rgba(255, 81, 81, 1) 0%, rgba(50, 137, 255, 1) 100%)',
            color: 'transparent',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text'
        };
    }

    return { color: getNicknameColor(equipment, isDarkTheme) };
};

export const extractColorFromLabel = (description: string, isDarkTheme: boolean): string => {
    const defaultColor = isDarkTheme ? '#FFFFFF' : '#000000';
    const match = description.match(/<label class='x-([^']+)'>.*?<\/label>/);
    if (!match) return defaultColor;

    const colorKey = match[1].toLowerCase().replace('_name', '');
    return NICKNAME_COLORS[colorKey] || defaultColor;
};

export const formatNumber = (num: number): string => {
    return num.toFixed(3).replace(/\.?0+$/, '');
};

export const calculateTotalOptions = (itemsData: ItemInfo[]) => {
    const totals: Record<string, number> = {};

    itemsData.forEach(item => {
        if (isSpecialOptions(item.options)) {
            const relevantOptions = Date.now() >= item.options.date ? item.options.after : item.options.before;
            Object.entries(relevantOptions).forEach(([key, value]) => {
                if (value !== undefined && typeof value === 'number' && !isNaN(value)) {
                    totals[key] = (totals[key] || 0) + Number(value) * (key[0] === 'g' ? 100 : 1000);
                }
            });
        } else {
            Object.entries(item.options).forEach(([key, value]) => {
                if (value !== undefined && typeof value === 'number' && !isNaN(value)) {
                    totals[key] = (totals[key] || 0) + Number(value) * (key[0] === 'g' ? 100 : 1000);
                }
            });
        }
    });

    return totals;
};

export const getModeName = (modeId: string, modesData: Mode[]): string => {
    const mode = modesData.find(m => m.modeId === modeId);
    return mode ? mode.modeName : modeId;
};

export const getModeGroup = (modeId: string, modesData: Mode[]): string => {
    const mode = modesData.find(m => m.modeId === modeId);
    return mode ? mode.group : 'unknown';
};

export const groupRecordsByMode = (records: KkukoRecord[], modesData: Mode[]) => {
    const groups: Record<string, KkukoRecord[]> = {
        kor: [],
        eng: [],
        event: []
    };

    records.forEach(rec => {
        const group = getModeGroup(rec.modeId, modesData);
        if (groups[group]) {
            groups[group].push(rec);
        }
    });

    return groups;
};

export const calculateWinRate = (win: number, total: number): string => {
    if (total === 0) return '0.00';
    return ((win / total) * 100).toFixed(2);
};

export const formatObservedAt = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

export const getSlotName = (slot: string): string => {
    return SLOT_NAMES[slot] || slot;
};

export const getOptionName = (key: string): string => {
    return OPTION_NAMES[key] || key;
};

export const formatLastSeen = (updatedAt: string): string => {
    const lastSeen = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}일 전`;
    } else if (diffHours > 0) {
        return `${diffHours}시간 전`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes}분 전`;
    }
};

export interface DescriptionPart {
    text: string;
    colorKey?: string;
}

export const parseDescription = (description: string): DescriptionPart[] => {
    const parts: DescriptionPart[] = [];
    const regex = /<label class='x-([^']+)'>([^<]*)<\/label>/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(description)) !== null) {
        // Add text before the label
        if (match.index > lastIndex) {
            parts.push({
                text: description.substring(lastIndex, match.index)
            });
        }

        // Add colored label text
        const colorKey = match[1].toLowerCase().replace('_name', '');
        parts.push({
            text: match[2],
            colorKey
        });

        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < description.length) {
        parts.push({
            text: description.substring(lastIndex)
        });
    }

    return parts;
};
