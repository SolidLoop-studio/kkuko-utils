"use client";

import React, { useEffect, useMemo, useState } from "react";
import { disassemble } from "es-hangul";
import { noInjungTopic } from "../const";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { Badge } from "@/app/components/ui/badge";
import { ChevronDown, Save, Search, AlertTriangle, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card";
import useSWR from "swr";
import ErrorModal from "@/app/components/ErrModal";
import { fetcher } from "../lib";
import { PostgrestError } from "@supabase/supabase-js";
import HelpModal from "@/app/components/HelpModal";
import { calculateKoreanInitials } from "@/app/lib/lib";

// Utility function for Korean search filtering
const filterKoreanText = (text: string, search: string) => {
    if (search === "") return true;
    let indexText = 0;
    let indexSearch = 0;

    while (indexText < text.length && indexSearch < search.length) {
        if (
            text[indexText] === search[indexSearch] ||
            (("ㄱ" <= search[indexSearch] && search[indexSearch] <= "ㅎ") &&
                calculateKoreanInitials(text[indexText]) === calculateKoreanInitials(search[indexSearch]))
        ) {
            indexSearch++;
        }
        indexText++;
    }

    return indexSearch === search.length;
};

type TopicItemProps = {
    label: string;
    code: string;
    isSelected: boolean;
    onChange: (code: string) => void;
};

// Topic selection component with better visual feedback
const TopicItem = React.memo(({
    label,
    code,
    isSelected,
    onChange
}: TopicItemProps) => {
    return (
        <label
            className={`flex items-center p-2 rounded cursor-pointer transition-colors dark:border-gray-600
                        ${isSelected
                    ? "bg-primary/20 hover:bg-primary/30"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        >
            <input
                type="checkbox"
                onChange={() => onChange(code)}
                checked={isSelected}
                className="mr-2 h-4 w-4"
            />
            <span className="truncate">{label}</span>
        </label>
    );
});

TopicItem.displayName = "TopicItem";

type TopicsListProps = {
    topics: [string, string][];
    selectedTopics: string[];
    onChange: (code: string) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
};

// Topic list component with search functionality
const TopicsList = React.memo(({
    topics,
    selectedTopics,
    onChange,
    searchTerm,
    onSearchChange
}: TopicsListProps) => {
    return (
        <div className="space-y-3 w-full">
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="주제 검색"
                    className="pl-8"
                />
            </div>

            <ScrollArea className="h-48 border rounded-md p-1 w-full dark:border-gray-600">
                <div className="grid grid-cols-2 gap-1">
                    {topics.length > 0 ? topics.map(([label, code]) => (
                        <TopicItem
                            key={code}
                            label={label}
                            code={code}
                            isSelected={selectedTopics.includes(code)}
                            onChange={onChange}
                        />
                    )) : (
                        <div className="col-span-2 flex items-center justify-center h-32 text-gray-500">
                            검색 결과가 없습니다
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
});

TopicsList.displayName = "TopicsList";

type TopicSectionProps = {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    topics: [string, string][];
    selectedTopics: string[];
    onChange: (code: string) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
};

// Topic section with collapsible UI
const TopicSection = ({
    title,
    isOpen,
    onToggle,
    topics,
    selectedTopics,
    onChange,
    searchTerm,
    onSearchChange
}: TopicSectionProps) => {
    return (
        <Collapsible open={isOpen} onOpenChange={onToggle} className="border rounded-md">
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    <span className="font-medium">{title}</span>
                    <ChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3">
                {isOpen && (
                    <TopicsList
                        topics={topics}
                        selectedTopics={selectedTopics}
                        onChange={onChange}
                        searchTerm={searchTerm}
                        onSearchChange={onSearchChange}
                    />
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};

type SelectedTopic = {
    code: string;
    label: string;
};

type SelectedTopicsProps = {
    topics: SelectedTopic[];
    onRemove: (code: string) => void;
};

// Selected topics display component
const SelectedTopics = ({ topics, onRemove }: SelectedTopicsProps) => {
    if (topics.length === 0) {
        return (
            <div className="text-gray-500 italic text-sm">
                선택된 주제가 없습니다. 주제를 선택해 주세요.
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
                <Badge
                    key={topic.code}
                    variant="secondary"
                    className="flex items-center gap-1 py-1"
                >
                    {topic.label}
                    <button
                        onClick={() => onRemove(topic.code)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
        </div>
    );
};

type InfoItemProps = {
    label: string;
    value: string | number;
};

// Info item for word details
const InfoItem = ({ label, value }: InfoItemProps) => (
    <div className="flex justify-between items-center py-1.5 border-b last:border-b-0">
        <span className="w-12 text-sm font-medium text-gray-600 whitespace-nowrap dark:text-gray-200">{label}</span>
        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{value}</span>
    </div>
);

interface TopicInfo {
    topicsCode: Record<string, string>;
    topicsKo: Record<string, string>;
    topicsID: Record<string, number>;
}

type WordAddFormProps = {
    saveFn: (word: string, themes: string[]) => Promise<void>;
    initWord?: string;
    initThemes?: string[];
};

// Main component
const WordAddForm = ({ saveFn, initWord = "", initThemes = [] }: WordAddFormProps) => {
    const [word, setWord] = useState<string>(initWord);
    const [selectedTopics, setSelectedTopics] = useState<string[]>(initThemes);
    const [groupVisibility, setGroupVisibility] = useState<{ noInjung: boolean; other: boolean }>({
        noInjung: false,
        other: false,
    });
    const [searchTermNoInjung, setSearchTermNoInjung] = useState("");
    const [searchTermOther, setSearchTermOther] = useState("");
    const [invalidWord, setInvalidWord] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { data, error, isLoading } = useSWR("themes", fetcher);
    const [topicInfo, setTopicInfo] = useState<TopicInfo>({
        topicsCode: {},
        topicsKo: {},
        topicsID: {}
    });
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);

    useEffect(() => {
        if (error) {
            setErrorModalView({
                ErrMessage: "An error occurred while fetching data.",
                ErrName: "ErrorFetchingData",
                ErrStackRace: "",
                inputValue: "themes fetch"
            });
        }
    }, [error]);

    // Transform API data into usable format
    useEffect(() => {
        if (!data) return;
        const newTopicsCode: Record<string, string> = {};
        const newTopicsKo: Record<string, string> = {};
        const newTopicID: Record<string, number> = {};

        data.forEach((d: { code: string, name: string, id: number }) => {
            newTopicsCode[d.code] = d.name;
            newTopicsKo[d.name] = d.code;
            newTopicID[d.code] = d.id;
        });

        setTopicInfo({
            topicsCode: newTopicsCode,
            topicsKo: newTopicsKo,
            topicsID: newTopicID
        });
    }, [data]);

    useEffect(() => {
        setIsSaving(isLoading);
    }, [isLoading]);

    // Group topics into categories
    const groupedTopics = useMemo(() => {
        const noInjung = Object.entries(topicInfo.topicsKo)
            .filter(([label]) => noInjungTopic.includes(label))
            .sort((a, b) => a[0].localeCompare(b[0]))
            .filter(([label]) => filterKoreanText(label, searchTermNoInjung));

        const other = Object.entries(topicInfo.topicsKo)
            .filter(([label]) => !noInjungTopic.includes(label))
            .sort((a, b) => a[0].localeCompare(b[0]))
            .filter(([label]) => filterKoreanText(label, searchTermOther));

        return { noInjung, other };
    }, [topicInfo, searchTermNoInjung, searchTermOther]);

    // Generate word information for display
    const wordInfo = useMemo(() => ({
        firstLetter: word.charAt(0) || "-",
        lastLetter: word.charAt(word.length - 1) || "-",
        length: word.length,
        initials: calculateKoreanInitials(word) || "-",
    }), [word]);

    // Validate Korean word input
    const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWord = e.target.value;
        setWord(newWord);

        const regex = /^[0-9ㄱ-힣]*$/;
        let hasInvalidChar = false;

        if (newWord) {
            const regex1 = /[0-9ㄱ-ㅎ]+/;
            for (const c of newWord) {
                if (!regex1.test(disassemble(c)[0])) {
                    hasInvalidChar = true;
                    break;
                }
            }
        }

        setInvalidWord(!regex.test(newWord) || hasInvalidChar);
    };

    // Toggle topic selection
    const handleTopicChange = React.useCallback((topicCode: string) => {
        setSelectedTopics((prev) =>
            prev.includes(topicCode)
                ? prev.filter((code) => code !== topicCode)
                : [...prev, topicCode]
        );
    }, []);

    // Remove a selected topic
    const handleRemoveTopic = (topicCode: string) => {
        setSelectedTopics((prev) => prev.filter((code) => code !== topicCode));
    };

    // Toggle section visibility
    const toggleGroupVisibility = (group: keyof typeof groupVisibility) => {
        setGroupVisibility((prev) => ({ ...prev, [group]: !prev[group] }));
    };

    // Get selected topics with labels for display
    const selectedTopicsWithLabels = useMemo(() => {
        return selectedTopics.map(code => ({
            code,
            label: topicInfo.topicsCode[code] || code
        }));
    }, [selectedTopics, topicInfo.topicsCode]);

    // Handle word save
    const onSave = async () => {
        if (isSaving) return;

        setIsSaving(true);

        try {
            await saveFn(word, selectedTopics);
            setWord("");
            setSelectedTopics([]);
        
        } catch (error) {
            if (error instanceof PostgrestError)
                setErrorModalView({
                    ErrName: error.name || "Unknown Error",
                    ErrMessage: error.message || "An unknown error occurred",
                    ErrStackRace: error.code || "",
                    inputValue: `word: ${word}, selected themes: ${selectedTopics.join(", ")}`
                });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 relative">
            {/* Loading overlay */}
            {isSaving && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center border dark:border-gray-700">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-300" size={"lg"} />
                        <p className="mt-4 font-medium text-gray-900 dark:text-gray-100">저장 중...</p>
                    </div>
                </div>
            )}

            {/* Input card */}
            <Card className="w-full lg:w-[60%] flex flex-col max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2 border-b border-gray-200 dark:border-gray-700">
                    <CardTitle className="text-2xl flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <span>단어 정보 입력</span>

                        {/* Help Modal */}
                        <HelpModal
                            title="단어 추가하기 사용법"
                            triggerText="도움말"
                            triggerClassName="border border-gray-200 dark:border-gray-600 border-1 rounded-md p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            <div className="space-y-6">
                                {/* Step 0 */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">0</span>
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">단어를 입력합니다.</h3>
                                    </div>
                                    <div className="ml-6 space-y-2">
                                        <p className="text-gray-700 dark:text-gray-300">한글 또는 숫자로만 입력할 수 있습니다.</p>
                                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <Input value="사과" disabled className="w-40 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600" />
                                            <div className="flex items-center gap-1 mt-2 text-red-500 dark:text-red-400 text-xs">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                한글과 숫자만 입력할 수 있습니다.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Step 1 */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">1</span>
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">주제를 선택합니다.</h3>
                                    </div>
                                    <div className="ml-6 space-y-2">
                                        <p className="text-gray-700 dark:text-gray-300">주제는 여러 개 선택할 수 있습니다. 검색창을 활용해 빠르게 찾을 수 있습니다.<br />주제없음은 노인정에서 찾을 수 있습니다.</p>
                                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <div className="flex flex-col gap-2">
                                                <Input value="과일" disabled className="w-40 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600" placeholder="주제 검색" />
                                                <div className="flex gap-2">
                                                    <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">과일</Badge>
                                                    <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">음식</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Step 2 */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">2</span>
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">단어 저장</h3>
                                    </div>
                                    <div className="ml-6 space-y-2">
                                        <p className="text-gray-700 dark:text-gray-300">단어와 주제를 모두 입력/선택해야 저장할 수 있습니다.</p>
                                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <Button className="w-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400" disabled>
                                                <Save className="mr-2 h-4 w-4" />
                                                단어 저장
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {/* Step 3 */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">3</span>
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">결과 확인</h3>
                                    </div>
                                    <div className="ml-6 space-y-2">
                                        <p className="text-gray-700 dark:text-gray-300">저장이 완료되면 완료 안내창이 나타납니다.</p>
                                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                                            <div className="text-sm text-green-800 dark:text-green-200">
                                                <span className="font-bold">사과</span> (주제: 과일, 음식) 추가 요청 완료!
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* 예시 */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">사용 예시</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">입력 예시:</p>
                                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs border border-gray-200 dark:border-gray-600">
                                                <div className="text-gray-700 dark:text-gray-300">단어: <span className="font-bold">사과</span></div>
                                                <div className="text-gray-700 dark:text-gray-300">주제: <span className="font-bold">과일, 음식</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="text-2xl text-gray-500 dark:text-gray-400">↓</div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">저장 결과:</p>
                                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                                                <div className="text-sm text-green-800 dark:text-green-200">
                                                    <span className="font-bold">사과</span> (주제: 과일, 음식) 추가 요청 완료!
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Tip */}
                                <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <p className="text-blue-800 dark:text-blue-200 text-sm">
                                        <strong>💡 팁:</strong> 주제는 언제든 검색해서 빠르게 찾을 수 있습니다.
                                    </p>
                                </div>
                                <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <p className="text-blue-800 dark:text-blue-200 text-sm">
                                        <strong>💡 참고:</strong> 단어는 관리자의 승인후 등록됩니다. 주로 2~3일 내에 처리되지만 빠르게 처리할 수 있도록 하겠습니다.
                                    </p>
                                </div>
                            </div>
                        </HelpModal>
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 overflow-y-auto bg-white dark:bg-gray-800">
                    {/* Word input section */}
                    <div className="space-y-2">
                        <label className="font-medium text-sm text-gray-700 dark:text-gray-300">단어</label>
                        <div>
                            <Input
                                value={word}
                                onChange={handleWordChange}
                                placeholder="단어를 입력하세요"
                                className={`bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${invalidWord ? "border-red-500 dark:border-red-400 focus-visible:ring-red-500 dark:focus-visible:ring-red-400" : "focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"}`}
                                disabled={isSaving}
                            />
                            {invalidWord && (
                                <div className="flex items-center gap-1 mt-1 text-red-500 dark:text-red-400 text-sm">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>한글과 숫자만 입력할 수 있습니다.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected topics display */}
                    <div className="space-y-2">
                        <label className="font-medium text-sm text-gray-700 dark:text-gray-300">선택된 주제</label>
                        <div className="min-h-10 bg-gray-50 dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
                            <SelectedTopics
                                topics={selectedTopicsWithLabels}
                                onRemove={handleRemoveTopic}
                            />
                        </div>
                    </div>

                    {/* Topics selection */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="font-medium text-sm text-gray-700 dark:text-gray-300">주제 선택</label>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {selectedTopics.length} 개 선택됨
                            </span>
                        </div>

                        <div className="space-y-3">
                            {/* 노인정 Topics */}
                            <TopicSection
                                title="노인정"
                                isOpen={groupVisibility.noInjung}
                                onToggle={() => toggleGroupVisibility("noInjung")}
                                topics={groupedTopics.noInjung}
                                selectedTopics={selectedTopics}
                                onChange={handleTopicChange}
                                searchTerm={searchTermNoInjung}
                                onSearchChange={setSearchTermNoInjung}
                            />

                            {/* 어인정 Topics */}
                            <TopicSection
                                title="어인정"
                                isOpen={groupVisibility.other}
                                onToggle={() => toggleGroupVisibility("other")}
                                topics={groupedTopics.other}
                                selectedTopics={selectedTopics}
                                onChange={handleTopicChange}
                                searchTerm={searchTermOther}
                                onSearchChange={setSearchTermOther}
                            />
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="pt-2 mt-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
                        onClick={onSave}
                        disabled={word.length === 0 || invalidWord || isSaving}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        단어 저장
                    </Button>
                </CardFooter>
            </Card>

            {/* Info card */}
            <Card className="w-full lg:w-[40%] flex flex-col max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2 border-b border-gray-200 dark:border-gray-700">
                    <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">단어 정보</CardTitle>
                </CardHeader>

                <CardContent className="space-y-6 overflow-y-auto bg-white dark:bg-gray-800">
                    {/* Word details */}
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm text-gray-500 dark:text-gray-400">단어 특성</h4>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600 ">
                            <InfoItem label="단어" value={word || "-"} />
                            <InfoItem label="길이" value={wordInfo.length || "0"} />
                            <InfoItem label="첫 글자" value={wordInfo.firstLetter} />
                            <InfoItem label="끝 글자" value={wordInfo.lastLetter} />
                            <InfoItem label="한글 초성" value={wordInfo.initials} />
                        </div>
                    </div>

                    {/* Topics details */}
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm text-gray-500 dark:text-gray-400">주제 정보</h4>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                            <InfoItem
                                label="주제"
                                value={selectedTopics.length > 0
                                    ? selectedTopics.map(code => topicInfo.topicsCode[code]).join(", ")
                                    : "-"}
                            />
                            <InfoItem
                                label="코드"
                                value={selectedTopics.join(", ") || "-"}
                            />
                        </div>
                    </div>

                </CardContent>
            </Card>

            {/* Modals */}
            {errorModalView &&
                <ErrorModal
                    error={errorModalView}
                    onClose={() => setErrorModalView(null)}
                />
            }

        </div>
    );
};

export default WordAddForm;