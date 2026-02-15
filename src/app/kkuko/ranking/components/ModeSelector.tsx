'use client';

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/src/app/components/ui/select';
import type { Mode } from '@/src/app/types/kkuko.types';

interface ModeSelectorProps {
    modes: Mode[];
    selectedMode: string;
    onModeChange: (modeId: string) => void;
}

const GROUP_LABELS: Record<string, string> = {
    def: '기본',
    kor: '🇰🇷 한국어 모드',
    eng: '🇺🇸 영어 모드',
    event: '🎉 이벤트 모드',
};

export function ModeSelector({ modes, selectedMode, onModeChange }: ModeSelectorProps) {
    // Group modes by category
    const groupedModes = modes.reduce((acc, mode) => {
        const group = mode.group || 'other';
        if (!['kor', 'eng', 'event', 'def'].includes(group)) return acc;
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(mode);
        return acc;
    }, {} as Record<string, Mode[]>);

    // Sort groups: kor, eng, event, others
    const sortedGroups = Object.keys(groupedModes).sort((a, b) => {
        const order = ['def', 'kor', 'eng', 'event'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <Select value={selectedMode} onValueChange={onModeChange}>
            <SelectTrigger className="w-[280px] bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
                <SelectValue placeholder="모드를 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700">
                {sortedGroups.map((group) => (
                    <SelectGroup key={group}>
                        <SelectLabel className="text-gray-700 dark:text-gray-300 font-semibold">
                            {GROUP_LABELS[group] || group.toUpperCase()}
                        </SelectLabel>
                        {groupedModes[group].map((mode) => (
                            <SelectItem 
                                key={mode.modeId} 
                                value={mode.modeId}
                                className="focus:bg-blue-100 dark:focus:bg-slate-700 text-gray-900 dark:text-white"
                            >
                                {mode.modeName}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}
