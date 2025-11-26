import { useState } from 'react';
import useSWR from 'swr';
import { X, Loader2 } from 'lucide-react';
import { SCM } from '@/app/lib/supabaseClient';
import { Theme } from '../types';

interface ThemeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTheme: { id: number; name: string } | null;
    onSelectTheme: (theme: { id: number; name: string } | null) => void;
}

export default function ThemeSelectionModal({
    isOpen,
    onClose,
    selectedTheme,
    onSelectTheme
}: ThemeSelectionModalProps) {
    const [themeSearchQuery, setThemeSearchQuery] = useState('');

    const { data: themes, error: themesError } = useSWR<Theme[]>(
        isOpen ? 'themes' : null,
        async () => {
            const { data, error } = await SCM.get().allThemes();
            if (error) throw error;
            return data;
        }
    );

    if (!isOpen) return null;

    const filteredAndGroupedThemes = () => {
        if (!themes) return { groupA: [], groupB: [] };

        const filtered = themeSearchQuery.trim() === ''
            ? themes
            : themes.filter(theme => 
                theme.name.toLowerCase().includes(themeSearchQuery.toLowerCase()) ||
                theme.code.toLowerCase().includes(themeSearchQuery.toLowerCase())
            );

        const groupA = filtered.filter(theme => /^\d+$/.test(theme.code));
        const groupB = filtered.filter(theme => !/^\d+$/.test(theme.code));

        return { groupA, groupB };
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">주제 선택</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <input
                        type="text"
                        value={themeSearchQuery}
                        onChange={(e) => setThemeSearchQuery(e.target.value)}
                        placeholder="주제 검색..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!themes ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                            <span className="ml-2 text-gray-600 dark:text-gray-300">주제 로딩 중...</span>
                        </div>
                    ) : themesError ? (
                        <div className="text-center py-12">
                            <p className="text-red-500">주제를 불러오는 중 오류가 발생했습니다</p>
                        </div>
                    ) : (() => {
                        const { groupA, groupB } = filteredAndGroupedThemes();
                        return (
                            <div className="space-y-6">
                                {themeSearchQuery.trim() === '' ? (
                                    <>
                                        {/* 전체 선택 옵션 */}
                                        <div className="mb-4">
                                            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border-2 border-gray-200 dark:border-gray-700">
                                                <input
                                                    type="radio"
                                                    name="theme"
                                                    checked={selectedTheme === null}
                                                    onChange={() => onSelectTheme(null)}
                                                    className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                                                />
                                                <div>
                                                    <span className="font-medium text-gray-800 dark:text-gray-100">주제 미선택</span>
                                                </div>
                                            </label>
                                        </div>

                                        {/* 그룹 A: 숫자 코드 */}
                                        {groupA.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                    노인정 주제
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {groupA.sort((a,b) => a.name.localeCompare(b.name, 'ko')).map((theme) => (
                                                        <label
                                                            key={theme.id}
                                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="theme"
                                                                value={theme.id}
                                                                checked={selectedTheme?.id === theme.id}
                                                                onChange={() => onSelectTheme({id: theme.id, name: theme.name})}
                                                                className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 flex-shrink-0"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="font-medium text-gray-800 dark:text-gray-100 inline-block max-w-full truncate align-middle">{theme.name}</span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">({theme.code})</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 그룹 B: 기타 코드 */}
                                        {groupB.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                    어인정 주제
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {groupB.sort((a,b) => a.name.localeCompare(b.name, 'ko')).map((theme) => (
                                                        <label
                                                            key={theme.id}
                                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="theme"
                                                                value={theme.id}
                                                                checked={selectedTheme?.id === theme.id}
                                                                onChange={() => onSelectTheme({id: theme.id, name: theme.name})}
                                                                className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 flex-shrink-0"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="font-medium text-gray-800 dark:text-gray-100 inline-block max-w-full truncate align-middle">{theme.name}</span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">({theme.code})</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* 검색 결과 */}
                                        {groupA.length === 0 && groupB.length === 0 ? (
                                            <div className="text-center py-12">
                                                <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {[...groupA, ...groupB].sort((a,b) => a.name.localeCompare(b.name, 'ko')).map((theme) => (
                                                    <label
                                                        key={theme.id}
                                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="theme"
                                                            value={theme.id}
                                                            checked={selectedTheme?.id === theme.id}
                                                            onChange={() => onSelectTheme({id: theme.id, name: theme.name})}
                                                            className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-medium text-gray-800 dark:text-gray-100 block truncate">{theme.name}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">({theme.code})</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
