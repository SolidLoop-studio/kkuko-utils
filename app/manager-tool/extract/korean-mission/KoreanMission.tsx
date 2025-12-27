"use client";
import React, { useState } from "react";
import ErrorModal from "@/app/components/ErrModal";
import type { ErrorMessage } from '@/app/types/type'
import Spinner from "@/app/components/Spinner";
import { DefaultDict } from "@/app/lib/collections";
import FileContentDisplay from "../components/FileContentDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Badge } from "@/app/components/ui/badge";
import { Download, Play, Settings, Zap, Home } from "lucide-react";
import Link from "next/link";
import HelpModal from "@/app/components/HelpModal";

const sortedLength = (a: { word: string, mission: number }, b: { word: string, mission: number }) => b.word.length - a.word.length;
const sortedAlphabet = (a: { word: string, mission: number }, b: { word: string, mission: number }) => a.word.localeCompare(b.word, "ko-KR");
const sortedMission = (a: { word: string, mission: number }, b: { word: string, mission: number }) => b.mission - a.mission;
const pack = { "미션글자 포함순": sortedMission, "글자길이순": sortedLength, "ㄱㄴㄷ순": sortedAlphabet };

const MISSION_CHARS = "가나다라마바사아자차카타파하";
const countMissionChar = (word: string, char: string): number => (word.match(new RegExp(char, "gi")) || []).length;

const formatWord = (word: string): string => {
    let result = `${word} `;
    for (const m of MISSION_CHARS) {
        const count = countMissionChar(word, m);
        if (count >= 1) result += `[${m}${count}]`;
    }
    return result;
};

const WordExtractorApp = () => {
    type op = "미션글자 포함순" | "글자길이순" | "ㄱㄴㄷ순";
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [extractedWords, setExtractedWords] = useState<string[]>([]);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [loading, setLoading] = useState(false);
    const [oneMissionChecked, setOneMissionChecked] = useState<boolean>(false);
    const [showMissionLetter, setShowMissionLetter] = useState<boolean>(false);
    const [excludeFirstMissionChecked, setExcludeFirstMissionChecked] = useState<boolean>(false);
    const [selected, setSelected] = useState<op[]>([]);

    const options: ["미션글자 포함순", "글자길이순", "ㄱㄴㄷ순"] = ["미션글자 포함순", "글자길이순", "ㄱㄴㄷ순"];

    const handleToggle = (option: op) => {
        setSelected((prev) => {
            if (prev.includes(option)) {
                return prev.filter((item) => item !== option); // 선택 해제
            }
            if (prev.length < 3) {
                return [...prev, option]; // 새로운 선택 추가
            }
            return prev; // 3개 초과 선택 방지
        });
    }

    // 파일 업로드 처리
    const handleFileUpload = (content: string) => {
        setFileContent(content);
    };

    // 에러 처리
    const handleError = (error: unknown) => {
        if (error instanceof Error) {
            seterrorModalView({
                ErrName: error.name,
                ErrMessage: error.message,
                ErrStackRace: error.stack,
                inputValue: null
            });
        } else {
            seterrorModalView({
                ErrName: null,
                ErrMessage: null,
                ErrStackRace: error as string,
                inputValue: null
            });
        }
    };

    // 우선순위에 맞게 단어 정렬
    const sortWords = (
        list: { word: string; mission: number }[],
        rank1: (a: { word: string, mission: number }, b: { word: string, mission: number }) => number,
        rank2?: (a: { word: string, mission: number }, b: { word: string, mission: number }) => number,
        rank3?: (a: { word: string, mission: number }, b: { word: string, mission: number }) => number
    ) => {
        return list.sort((a, b) => {
            const r1 = rank1(a, b);
            if (r1 !== 0) return r1;
            const r2 = rank2?.(a, b);
            if (r2 !== undefined && r2 !== 0) return r2;
            const r3 = rank3?.(a, b);
            return r3 ?? sortedAlphabet(a, b);
        });
    };

    // 미션 단어들 추출
    const buildMissionMap = (
        content: string,
        include: number,
        excludeFirstMission: boolean
    ): DefaultDict<string, { word: string; mission: number }[]> => {
        const dict = new DefaultDict<string, { word: string; mission: number }[]>(() => []);
        for (const m of MISSION_CHARS) {
            for (const raw of content.split('\n')) {
                const word = raw.trim();
                if (!word) continue;
                if (excludeFirstMission && MISSION_CHARS.includes(word[0])) continue;
                const count = countMissionChar(word, m);
                if (count >= include) dict.get(m).push({ word, mission: count });
            }
        }
        return dict;
    };

    // 
    const handleAlphabeticalSort = (
        missionMap: DefaultDict<string, { word: string; mission: number }[]>,
        rank2?: (a: { word: string, mission: number }, b: { word: string, mission: number }) => number,
        rank3?: (a: { word: string, mission: number }, b: { word: string, mission: number }) => number,
    ): string[] => {
        const result: string[] = [];

        // 오로지 ㄱㄴㄷ순 정렬만 있을 경우
        if (rank2 === undefined) {
            // 중복 단어가 많이 쌓여 정렬에서 스택 오버플로우가 발생할 수 있으므로
            // Set으로 중복을 제거하고 단순 localeCompare 정렬로 처리합니다.
            const set = new Set<string>();
            for (const m of MISSION_CHARS) {
                for (const { word } of missionMap.get(m)) {
                    set.add(word);
                }
            }
            const arr = Array.from(set);
            arr.sort((a, b) => a.localeCompare(b, "ko-KR"));
            return showMissionLetter ? arr.map(word => formatWord(word)) : arr;
        }
        // 2순위가 미션글자 포함순일때
        else if (selected[1] === "미션글자 포함순") {
            // 앞글자가 같은 단어들 모으기 {첫글자: {미션글자: {단어,미션수}[]}}
            const firstCharMissionMap = new DefaultDict<string, DefaultDict<string, { word: string, mission: number }[]>>(() => new DefaultDict(() => []));
            for (const [missionChar, words] of missionMap.sortedEntries()) {
                for (const { word, mission } of words) {
                    firstCharMissionMap.get(word[0]).get(missionChar).push({ word, mission });
                }
            }

            // 우선순위에 맞게 정렬
            for (const [letter, wordsSet] of firstCharMissionMap.entries()) {
                result.push(`=[${letter}]=`);
                for (const [missionChar, words] of wordsSet.sortedEntries()) {
                    result.push(`-${missionChar}-`);
                    const temp2 = words.sort(
                        (a, b) => {
                            if (rank2 !== undefined) {
                                const k = rank2(a, b);
                                if (k != 0) return k;
                            }
                            if (rank3 !== undefined) {
                                return rank3(a, b);
                            }
                            return sortedLength(a, b);
                        })
                    result.push(...temp2.map(({ word }) => (showMissionLetter ? formatWord(word) : word)))
                    result.push('');
                }
            }
            return result;
        }
        // 2순위가 글자 길이순 일때
        else {
            for (const [missionChar, words] of missionMap.sortedEntries()) {
                if (words.length === 0) {
                    continue;
                }
                // 우선순위에 맞게 정렬
                words.sort(
                    (a, b) => {
                        const k = pack[selected[0]](a, b);
                        if (k != 0) return k;

                        if (rank2 !== undefined) {
                            const k = rank2(a, b)
                            if (k != 0) return k;
                        }

                        if (rank3 != undefined) {
                            return rank3(a, b)
                        }

                        return sortedAlphabet(a, b);
                    })
                result.push(`==[[${missionChar}]]==`);
                // 현재 진행중인 앞글자 마킹 / 단어 리스트
                let nowFirstChar: undefined | string = undefined;
                let nowFirstCharWords: { word: string, mission: number }[] = [];

                // 앞글자 끼리 같은거 모으기
                for (const { mission, word } of words) {
                    if (!nowFirstChar) {
                        nowFirstChar = word[0];
                        nowFirstCharWords.push({ word, mission });
                    } else {
                        if (word[0] == nowFirstChar) {
                            nowFirstCharWords.push({ word, mission })
                        } else {
                            nowFirstCharWords.sort(
                                (a, b) => {
                                    if (rank2 !== undefined) {
                                        const k = rank2(a, b);
                                        if (k != 0) return k;
                                    }
                                    if (rank3 !== undefined) {
                                        const k = rank3(a, b);
                                        return k;
                                    }
                                    return sortedLength(a, b);
                                })
                            result.push(`=[${nowFirstChar}]=`);
                            result.push(...nowFirstCharWords.map(({ word }) => (showMissionLetter ? formatWord(word) : word)));
                            result.push('');
                            nowFirstChar = word[0];
                            nowFirstCharWords = [];
                            nowFirstCharWords.push({ word, mission })
                        }
                    }
                }
                if (nowFirstCharWords.length > 0) {
                    result.push(`=[${nowFirstChar}]=`);
                    result.push(...nowFirstCharWords.map(({ word }) => (showMissionLetter ? formatWord(word) : word)));
                    result.push('');
                }
                result.push('');
            }

            return result;
        }

    };


    // 단어 추출 메인 함수
    const extractWords = async () => {
        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 1));

            if (!fileContent || selected.length === 0) return;

            const include = oneMissionChecked ? 1 : 2;
            const missionMap = buildMissionMap(fileContent, include, excludeFirstMissionChecked);
            const rank1 = pack[selected[0]];
            const rank2 = pack[selected[1]];
            const rank3 = pack[selected[2]];
            const result: string[] = [];

            switch (selected[0]) {
                case "미션글자 포함순":
                case "글자길이순":
                    for (const m of MISSION_CHARS) {
                        const group = missionMap.get(m);
                        if (group.length > 0) {
                            if (selected[0] === "미션글자 포함순") result.push(`=[${m}]=`);
                            const sorted = sortWords(group, rank1, rank2, rank3);
                            result.push(...sorted.map(i => showMissionLetter ? formatWord(i.word) : i.word));
                            result.push(' ');
                        } else {
                            if (selected[0] === "미션글자 포함순") result.push(`=[${m}]=`, ' ');
                        }
                    }
                    break;

                case "ㄱㄴㄷ순":
                    result.push(...handleAlphabeticalSort(missionMap, rank2, rank3));
                    break;
            }

            setExtractedWords(result);
        } catch (err) {
            handleError(err);
        } finally {
            setLoading(false);
        }
    };

    // 다운로드 처리
    const downloadExtractedWords = () => {
        try {
            if (extractedWords.length === 0) return;
            const blob = new Blob([extractedWords.join("\n")], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${file?.name.substring(0, file?.name.lastIndexOf(".")) || "unkown"}_미션단어 목록.txt`;
            link.click();
        } catch (err) {
            handleError(err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    한국어 미션단어 추출 - A
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    텍스트 파일에서 한국어 미션단어들을 추출합니다
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Link href="/manager-tool/extract">
                                <Button variant="outline" size="sm">
                                    <Home size="sm" />
                                    도구홈
                                </Button>
                            </Link>
                            <HelpModal
                                title="한국어 미션단어 추출 - A 사용법"
                                triggerText="도움말"
                                triggerClassName="border border-gray-200 border-1 rounded-md p-2"
                            >
                                <div className="space-y-6">
                                    {/* Step 0 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">0</span>
                                            <h3 className="font-semibold">텍스트 파일을 업로드 합니다.</h3>
                                        </div>
                                    </div>

                                    {/* Step 1 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">1</span>
                                            <h3 className="font-semibold">설정</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p>정렬모드를 선택합니다.</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <div className="space-y-2">
                                                    {options.map((option) => (
                                                        <div key={option} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox id={`sort-${option}`} disabled />
                                                                <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                                    {option}
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">2</span>
                                            <h3 className="font-semibold">실행</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p>실행 버튼을 누르고 기다립니다.</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <Button className="w-full h-8" disabled>
                                                    <Play className="w-3 h-3 mr-2" />
                                                    단어 추출
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">3</span>
                                            <h3 className="font-semibold">결과 확인 및 다운로드</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p>결과를 확인한 후 다운로드합니다.</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <Button variant="secondary" className="w-full h-8" disabled>
                                                    <Download className="w-3 h-3 mr-2" />
                                                    결과 다운로드
                                                    <Badge variant="default" className="ml-2 text-xs">5</Badge>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 예시 */}
                                    <div className="space-y-3">
                                        <h3 className="font-semibold">사용 예시</h3>
                                        <div className="space-y-3">
                                            준비중입니다...
                                        </div>
                                    </div>

                                    <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-blue-800 text-sm">
                                            <strong>💡 팁:</strong> 1미 포함 옵션을 체크하면 1미 단어도 추출됩니다. (기본 2미이상)
                                        </p>
                                    </div>
                                    <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-blue-800 text-sm">
                                            <strong>💡 팁:</strong> 미션글자 표시옵션을 체크했을때 예시: (바나나 [나2][바1])
                                        </p>
                                    </div>
                                </div>
                            </HelpModal>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* File Content Display - 3/4 width */}
                    <div className="xl:col-span-3">
                        <FileContentDisplay
                            fileContent={fileContent}
                            setFileContent={setFileContent}
                            setFile={setFile}
                            file={file}
                            onFileUpload={handleFileUpload}
                            onError={handleError}
                            resultData={extractedWords}
                            resultTitle={`미션단어 목록`}
                        />
                    </div>

                    {/* Control Panel - 1/4 width */}
                    <div className="xl:col-span-1">
                        <div className="space-y-6">
                            {/* Settings Card */}
                            <Card className="dark:bg-gray-800 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 dark:text-white">
                                        <Settings className="h-5 w-5 dark:text-gray-400" />
                                        설정
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="one-mission"
                                            checked={oneMissionChecked}
                                            onCheckedChange={(checked) => setOneMissionChecked(checked as boolean)}
                                        />
                                        <Label
                                            htmlFor="one-mission"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                                        >
                                            1미 포함
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="show-mletter"
                                            checked={showMissionLetter}
                                            onCheckedChange={(checked) => setShowMissionLetter(checked as boolean)}
                                        />
                                        <Label
                                            htmlFor="show-mletter"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                                        >
                                            미션 글자 표시
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="exclude-first-mission"
                                            checked={excludeFirstMissionChecked}
                                            onCheckedChange={(checked) => setExcludeFirstMissionChecked(checked as boolean)}
                                        />
                                        <Label
                                            htmlFor="exclude-first-mission"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                                        >
                                            첫글자 미션글자 제외
                                        </Label>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium dark:text-gray-200">정렬 모드</Label>
                                            <Badge variant="secondary" className="text-xs">
                                                {selected.length}/3
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            {options.map((option) => (
                                                <div key={option} className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`sort-${option}`}
                                                            checked={selected.includes(option)}
                                                            onCheckedChange={() => handleToggle(option)}
                                                        />
                                                        <Label
                                                            htmlFor={`sort-${option}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                                                        >
                                                            {option}
                                                        </Label>
                                                    </div>
                                                    {selected.includes(option) && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {selected.indexOf(option) + 1}순위
                                                        </Badge>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions Card */}
                            <Card className="dark:bg-gray-800 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 dark:text-white">
                                        <Play className="h-5 w-5 dark:text-gray-400" />
                                        실행
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button
                                        onClick={extractWords}
                                        className="w-full"
                                        disabled={!fileContent || loading}
                                    >
                                        <Play className="w-4 h-4 mr-2" />
                                        {loading ? "처리중..." : "단어 추출"}
                                    </Button>

                                    <Button
                                        onClick={downloadExtractedWords}
                                        variant="secondary"
                                        className="w-full"
                                        disabled={extractedWords.length === 0}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        결과 다운로드
                                        {extractedWords.length > 0 && (
                                            <Badge variant="default" className="ml-2">
                                                {extractedWords.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Status Card */}
                            {fileContent && (
                                <Card className="dark:bg-gray-800 dark:border-gray-700">
                                    <CardContent className="pt-6">
                                        <div className="text-center space-y-2">
                                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                {fileContent.split('\n').length}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                파일의 총 단어 수
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {errorModalView && (
                <ErrorModal
                    onClose={() => seterrorModalView(null)}
                    error={errorModalView}
                />
            )}

            {/* loading */}
            {loading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-4">
                        <Spinner />
                        <span className="text-gray-900 dark:text-white">처리 중입니다...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WordExtractorApp;