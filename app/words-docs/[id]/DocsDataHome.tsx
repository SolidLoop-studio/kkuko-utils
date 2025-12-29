"use client";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import WordsTableBody from "./WordsTableBody";
import Link from "next/link";
import type { WordData } from "@/app/types/type";
import { DefaultDict } from "@/app/lib/collections";
import "react-loading-skeleton/dist/skeleton.css";
import {
    Star,
    FileText,
    Target,
    AlignLeft,
    Download,
    Info,
    Clock,
    BookOpen,
    Loader2,
    Calendar,
} from "lucide-react";
import { SCM } from "@/app/lib/supabaseClient";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store/store";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";
import type { PostgrestError } from "@supabase/supabase-js";
import ErrorModal from "@/app/components/ErrModal";
import ToC from "./TableOfContents";

interface DocsPageProp {
    id: number;
    data: WordData[];
    metaData: {
        title: string;
        lastUpdate: string;
        typez: "letter" | "theme" | "ect"
    };
    starCount: string[];
    isSpecial?: boolean;
}

interface VirtualTocItem {
    title: string;
    index: number;
}

type TabType = "all" | "mission" | "long";

const MISSION_CHARS = "가나다라마바사아자차카타파하";

const DocsDataHome = ({ id, data, metaData, starCount, isSpecial }: DocsPageProp) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [tocList, setTocList] = useState<string[]>([]);
    const [wordsData] = useState<WordData[]>(data);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isTabSwitching, setIsTabSwitching] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<TabType>("all");
        const user = useSelector((state: RootState) => state.user);
        const specialIds = [208, 223, 238];
    const [isUserStarreda, setIsUserStarreda] = useState<boolean>(false);
    const [loginNeedModalOpen, setLoginNeedModalOpen] = useState<boolean>(false);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [charLastUpdates, setCharLastUpdates] = useState<Record<number, string | null>>({});

    // 유저 즐겨찾기 상태 업데이트
    useEffect(() => {
        if (user.uuid) {
            setIsUserStarreda(starCount.includes(user.uuid))
        }
    }, [user, starCount])

    // 미션 단어 미리 구하기
    const mission = useMemo(() => {
        const m2gr = new DefaultDict<string, WordData[]>(() => []);
        const m1gr = new DefaultDict<string, WordData[]>(() => []);

        MISSION_CHARS.split('').forEach(char => {
            data.forEach(item => {
                const count = (item.word.match(new RegExp(char, 'g')) || []).length;
                if (count > 1) {
                    m2gr.get(char).push(item);
                }
                else if (count == 1) {
                    m1gr.get(char).push(item);
                }
            })
        });
        return { m2gr, m1gr }
    }, [data])

    // 탭별 데이터 필터링
    const getFilteredData = (tabType: TabType): WordData[] => {
        switch (tabType) {
            case "all":
                return wordsData;
            case "long":
                return wordsData.filter(item => item.word.length >= 9);
            case "mission":
                const { m1gr, m2gr } = mission;
                const m: WordData[] = [];
                MISSION_CHARS.split('').forEach(char => {
                    const missionWords: WordData[] = m2gr.get(char).length > 8 ? m2gr.get(char) : [...m2gr.get(char), ...m1gr.get(char)];
                    m.push(...missionWords);
                });
                return [...new Set(m)];
            default:
                return wordsData;
        }
    };

    const filteredData = useMemo(() => getFilteredData(activeTab), [activeTab, wordsData]);

    const groupWordsBySyllable = (data: WordData[]) => {
        const grouped = new DefaultDict<string, WordData[]>(() => []);

        if (activeTab === "mission") {
            MISSION_CHARS.split('').forEach(char => {
                const { m1gr, m2gr } = mission;
                const missionWords: WordData[] = m2gr.get(char).length > 8 ? m2gr.get(char) : [...m2gr.get(char), ...m1gr.get(char)];
                if (missionWords.length > 0) {
                    grouped.get(`${char}`).push(...missionWords);
                }
            });
        } else {
            if (metaData.title.includes("앞말잇기")) {
                data.forEach((item) => {
                    const firstSyllable = item.word[item.word.length - 1].toLowerCase();
                    grouped.get(firstSyllable).push(item);
                });
            } else {
                data.forEach((item) => {
                    const firstSyllable = item.word[0].toLowerCase();
                    grouped.get(firstSyllable).push(item);
                });
            }

        }

        return grouped;
    };

    const memoizedGrouped = useMemo(() => {
        return groupWordsBySyllable(filteredData);
    }, [filteredData, activeTab]);


    useEffect(() => {
        if (![208,223,238].includes(id)) return;

        let mounted = true;
        const fetchUpdates = async () => {
            const chars = MISSION_CHARS.split('');
            const results = await Promise.all(chars.map(async (_c, index) => {
                const docId = id + index + 1;
                try {
                    const res = await SCM.get().docsLastUpdate(docId);
                    return { docId, last: res.data?.last_update ?? null };
                } catch {
                    return { docId, last: null };
                }
            }));

            if (!mounted) return;
            const map: Record<number, string | null> = {};
            results.forEach(r => { map[r.docId] = r.last; });
            setCharLastUpdates(map);
        };

        fetchUpdates();
        return () => { mounted = false; };
    }, [id]);

    const updateToc = (data: WordData[]): string[] => {
        if (activeTab === "mission") {
            const { m1gr, m2gr } = mission;
            return MISSION_CHARS.split('').filter(char => {
                return m2gr.get(char).length + m1gr.get(char).length > 0;
            }).map(char => `${char}`);
        } else {
            if (metaData.title.includes("앞말잇기")) return [...new Set(data.map((v) => v.word[v.word.length - 1]))].sort((a, b) => a.localeCompare(b, "ko"));
            return [...new Set(data.map((v) => v.word[0]))].sort((a, b) => a.localeCompare(b, "ko"));
        }
    };

    const virtualItems = useMemo(() => {
        return tocList.map((title, index) => ({
            title,
            data: memoizedGrouped.get(title) || [],
            index
        }));
    }, [tocList, memoizedGrouped, activeTab]);

    const tocItems: VirtualTocItem[] = useMemo(() => {
        return tocList.map((title, index) => ({
            title,
            index
        }));
    }, [tocList]);

    const virtualizer = useVirtualizer({
        count: virtualItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const item = virtualItems[index];
            const wordCount = item?.data?.length || 0;
            return Math.max(200, 80 + wordCount * 50 + 40);
        },
        overscan: 2,
        measureElement: (element) => {
            return element?.getBoundingClientRect().height ?? 0;
        },
    });

    useEffect(() => {
        const updateTabData = async () => {
            if (!isLoading) {
                setIsTabSwitching(true);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setTocList(updateToc(filteredData));
            setIsLoading(false);
            setIsTabSwitching(false);

            if (virtualizer) {
                virtualizer.scrollToOffset(0);
            }
        };

        updateTabData();
    }, [filteredData, activeTab]);

    const lastUpdateDate = new Date(metaData.lastUpdate);
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTime = lastUpdateDate.toLocaleString(undefined, { timeZone: userTimeZone });

    const handleDownload = () => {
        const currentData = getFilteredData(activeTab);
        const wordsText = currentData
            .map((w) => w.word)
            .sort((a, b) => a.localeCompare(b, "ko"))
            .join("\n");

        const formattedDate = new Date(metaData.lastUpdate).toISOString().slice(0, 10);
        const tabSuffix = activeTab === "all" ? "" : activeTab === "long" ? "_장문" : "_미션";
        const fileName = `${metaData.title}${tabSuffix} 단어장(${formattedDate}).txt`;

        const blob = new Blob([wordsText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDocsStar = async () => {
        if (!user.uuid) {
            return setLoginNeedModalOpen(true);
        }
        if (isUserStarreda) {
            const { error } = await SCM.delete().startDocs({ docsId: id, userId: user.uuid });
            if (error) return makeError(error)
        } else {
            const { error } = await SCM.add().starDocs({ docsId: id, userId: user.uuid });
            if (error) return makeError(error);
        }

        setIsUserStarreda(!isUserStarreda)
    }

    const makeError = (error: PostgrestError) => {
        setErrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.stack,
            inputValue: null
        });
    };

    const handleTocClick = (index: number) => {
        virtualizer.scrollToIndex(index, { align: 'start' });
    };

    const getTabIcon = (tab: TabType) => {
        switch (tab) {
            case "all":
                return <BookOpen className="w-4 h-4" />;
            case "mission":
                return <Target className="w-4 h-4" />;
            case "long":
                return <AlignLeft className="w-4 h-4" />;
        }
    };

    const getTabLabel = (tab: TabType) => {
        switch (tab) {
            case "all":
                return "전체";
            case "mission":
                return "미션";
            case "long":
                return "장문";
        }
    };

    const handleTabChange = async (newTab: TabType) => {
        if (newTab === activeTab) return;

        setIsTabSwitching(true);
        setActiveTab(newTab);
    };

    const getTabCount = (tab: TabType): number => {
        return getFilteredData(tab).length;
    };

    const currentStarCount = (user.uuid && starCount.includes(user.uuid) && !isUserStarreda)
        ? starCount.length - 1
        : (user.uuid && !starCount.includes(user.uuid) && isUserStarreda)
            ? starCount.length + 1
            : starCount.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 헤더 섹션 */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border-0 overflow-hidden mb-8">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 px-8 py-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="flex-1">
                                <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                                    {metaData.title}
                                </h1>
                                <div className="flex items-center gap-4 text-blue-100">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-sm">마지막 업데이트: {localTime}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 액션 버튼들 */}
                            <div className="flex flex-wrap gap-3">
                                <button
                                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${isUserStarreda
                                            ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-300"
                                            : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                                        }`}
                                    onClick={hadnleDocsStar}
                                >
                                    <Star
                                        className="w-5 h-5"
                                        fill={isUserStarreda ? "currentColor" : "none"}
                                    />
                                    <span>{currentStarCount}</span>
                                </button>

                                {!specialIds.includes(id) && (
                                    <>
                                        <Link href={`/words-docs/${id}/info`}>
                                            <button className="px-6 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                                                <Info className="w-5 h-5" />
                                                <span className="hidden sm:inline">문서 정보</span>
                                            </button>
                                        </Link>

                                        <Link href={`/words-docs/${id}/logs`}>
                                            <button className="px-6 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                                                <Clock className="w-5 h-5" />
                                                <span className="hidden sm:inline">로그</span>
                                            </button>
                                        </Link>

                                        <button
                                            className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                            onClick={handleDownload}
                                        >
                                            <Download className="w-5 h-5" />
                                            <span className="hidden sm:inline">다운로드</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 탭 네비게이션 */}
                    {metaData.typez !== "ect" && !specialIds.includes(id) && (
                        <div className="px-8 pt-6 pb-2 overflow-x-auto">
                            <nav className="flex space-x-1" aria-label="Tabs">
                                {(["all", "mission", "long"] as TabType[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => handleTabChange(tab)}
                                        disabled={isTabSwitching}
                                        className={`relative px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-3 ${activeTab === tab
                                                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                                                : "text-gray-600 dark:text-gray-200 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                                            } ${isTabSwitching ? "opacity-50 cursor-not-allowed" : "hover:shadow-md transform hover:-translate-y-0.5"
                                            }`}
                                    >
                                        {getTabIcon(tab)}
                                        <span>{getTabLabel(tab)}</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${activeTab === tab
                                                ? "bg-white/20 text-white"
                                                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200"
                                            }`}>
                                            {getTabCount(tab).toLocaleString()}
                                        </span>
                                        {activeTab === tab && (
                                            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}
                </div>

                {/* 목차 섹션 */}
                {!isTabSwitching && !specialIds.includes(id) && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border-0 p-6 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">목차</h2>
                        </div>
                        <ToC
                            items={tocItems}
                            onItemClick={handleTocClick}
                            isSp={activeTab === "mission"}
                        />
                    </div>
                )}

                {/* 컨텐츠 섹션 */}
                {specialIds.includes(id) ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border-0 p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">미션글자</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                            {["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"].map((char, index) => (
                                <Link
                                    key={char}
                                    href={`/words-docs/${id + index + 1}`}
                                    className="flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-200 group"
                                >
                                    <span className="text-2xl font-bold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {char}
                                    </span>
                                    <div className="mt-2 text-center">
                                        {charLastUpdates[id + index + 1] ? (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(charLastUpdates[id + index + 1] as string).toLocaleString(undefined, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</span>
                                        ) : (
                                            <span className="text-xs text-gray-400">업데이트 정보 없음</span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border-0 overflow-hidden">
                        {isLoading || isTabSwitching ? (
                            <div className="p-8">
                                {isTabSwitching ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                                        <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">탭 전환 중...</p>
                                        <p className="text-gray-400 dark:text-gray-400 text-sm mt-1">잠시만 기다려주세요</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {Array.from({ length: 5 }).map((_, idx) => (
                                            <div key={idx} className="animate-pulse">
                                                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-20 mb-4"></div>
                                                <div className="space-y-3">
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <FileText className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-2">
                                    단어를 찾을 수 없습니다
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {activeTab === "long" && "9자 이상의 장문 단어가 없습니다."}
                                    {activeTab === "mission" && "미션 조건에 해당하는 단어가 없습니다."}
                                </p>
                            </div>
                        ) : (
                            <div
                                ref={parentRef}
                                className="p-6"
                                style={{
                                    height: 'calc(100vh - 500px)',
                                    minHeight: '800px',
                                    overflow: 'auto',
                                }}
                            >
                                <div
                                    style={{
                                        height: `${virtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {virtualizer.getVirtualItems().map((virtualItem) => {
                                        const item = virtualItems[virtualItem.index];
                                        return (
                                            <div
                                                key={virtualItem.key}
                                                data-index={virtualItem.index}
                                                ref={virtualizer.measureElement}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                }}
                                            >
                                                <div className="mb-8">
                                                    <WordsTableBody
                                                        key={`${activeTab}-${item.title}-${item.data.length}`}
                                                        title={item.title}
                                                        initialData={item.data || []}
                                                        isMission={activeTab === "mission"}
                                                        isLong={activeTab === "long" || metaData.title.includes("긴단어")}
                                                        isSp={isSpecial ? { m: metaData.title[metaData.title.length - 1] } : undefined}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {loginNeedModalOpen && (
                <LoginRequiredModal open={loginNeedModalOpen} onClose={() => setLoginNeedModalOpen(false)} />
            )}
            {errorModalView && (
                <ErrorModal
                    onClose={() => setErrorModalView(null)}
                    error={errorModalView}
                />
            )}
        </div>
    );
};

export default DocsDataHome;