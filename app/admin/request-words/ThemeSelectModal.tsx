'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { SCM } from '@/app/lib/supabaseClient'

type Theme = {
    theme_id: number;
    theme_name: string;
    theme_code: string;
}

type AllTheme = {
    id: number;
    name: string;
    code: string;
}

type ThemeSelectModalProps = {
    isOpen: boolean;
    onClose: () => void;
    word: string;
    initialSelectedThemes: Theme[];
    initialSelectedThemeIds?: Set<number>;
    onConfirm: (selectedThemes: Theme[]) => void;
}

export default function ThemeSelectModal({
    isOpen,
    onClose,
    word,
    initialSelectedThemes,
    initialSelectedThemeIds,
    onConfirm
}: ThemeSelectModalProps) {
    const [allThemes, setAllThemes] = useState<AllTheme[]>([]);
    const [selectedThemes, setSelectedThemes] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    // 모달이 열릴 때 주제 목록 가져오기
    useEffect(() => {
        if (isOpen) {
            loadThemes();
            // 초기 선택된 주제 설정 - 요청으로 들어온 주제 + 이미 선택한 주제
            const requestThemeIds = new Set(initialSelectedThemes.map(t => t.theme_id));
            const previouslySelectedIds = initialSelectedThemeIds || new Set<number>();
            const combinedIds = new Set([...requestThemeIds, ...previouslySelectedIds]);
            setSelectedThemes(combinedIds);
        }
    }, [isOpen, initialSelectedThemes, initialSelectedThemeIds]);

    const loadThemes = async () => {
        setLoading(true);
        const { data, error } = await SCM.get().allThemes();
        if (!error && data) {
            setAllThemes(data);
        }
        setLoading(false);
    };

    // code가 숫자로만 이루어진지 확인
    const isNumericCode = (code: string) => /^\d+$/.test(code);

    // A그룹: code가 숫자인 것
    const groupA = allThemes.filter(theme => isNumericCode(theme.code));
    // B그룹: A그룹에 포함되지 않는 것
    const groupB = allThemes.filter(theme => !isNumericCode(theme.code));

    const toggleTheme = (themeId: number) => {
        const newSelected = new Set(selectedThemes);
        if (newSelected.has(themeId)) {
            newSelected.delete(themeId);
        } else {
            newSelected.add(themeId);
        }
        setSelectedThemes(newSelected);
    };

    const handleConfirm = () => {
        const selectedThemeObjects: Theme[] = allThemes
            .filter(theme => selectedThemes.has(theme.id))
            .map(theme => ({
                theme_id: theme.id,
                theme_name: theme.name,
                theme_code: theme.code
            }));
        onConfirm(selectedThemeObjects);
        onClose();
    };

    // 선택된 주제 정보 가져오기
    const getSelectedThemeNames = () => {
        return allThemes
            .filter(theme => selectedThemes.has(theme.id))
            .map(theme => theme.name);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>주제 선택 - {word}</DialogTitle>
                    <DialogDescription>
                        이 단어에 추가할 주제를 선택하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 선택된 주제 표시 */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                            선택된 주제 ({selectedThemes.size}개)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {selectedThemes.size === 0 ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    선택된 주제가 없습니다.
                                </span>
                            ) : (
                                getSelectedThemeNames().map((name, index) => (
                                    <Badge key={index} variant="secondary">
                                        {name}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 주제 선택 목록 */}
                    <ScrollArea className="h-[400px] pr-4">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                주제 목록을 불러오는 중...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* A그룹: 숫자 코드 */}
                                {groupA.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">
                                            일반 주제
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {groupA.map((theme) => (
                                                <div
                                                    key={theme.id}
                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    <Checkbox
                                                        id={`theme-${theme.id}`}
                                                        checked={selectedThemes.has(theme.id)}
                                                        onCheckedChange={() => toggleTheme(theme.id)}
                                                    />
                                                    <label
                                                        htmlFor={`theme-${theme.id}`}
                                                        className="text-sm cursor-pointer flex-1 text-gray-700 dark:text-gray-200"
                                                    >
                                                        {theme.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* B그룹: 특수 주제 */}
                                {groupB.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">
                                            특수 주제
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {groupB.map((theme) => (
                                                <div
                                                    key={theme.id}
                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    <Checkbox
                                                        id={`theme-${theme.id}`}
                                                        checked={selectedThemes.has(theme.id)}
                                                        onCheckedChange={() => toggleTheme(theme.id)}
                                                    />
                                                    <label
                                                        htmlFor={`theme-${theme.id}`}
                                                        className="text-sm cursor-pointer flex-1 text-gray-700 dark:text-gray-200"
                                                    >
                                                        {theme.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        취소
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedThemes.size === 0}>
                        확인 ({selectedThemes.size}개 선택)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
