"use client";
import React, { useState } from "react";
import { Counter } from "@/src/app/lib/collections";
import ErrorModal from "@/src/app/components/ErrModal";
import type { ErrorMessage } from '@/src/app/types/type'
import Spinner from "@/src/app/components/Spinner";
import FileContentDisplay from "../components/FileContentDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import { Badge } from "@/src/app/components/ui/badge";
import { Download, Play, Settings, Zap, Home } from "lucide-react";
import HelpModal from "@/src/app/components/HelpModal";
import Link from "next/link";

const WordExtractorApp = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [extractedWords, setExtractedWords] = useState<string[]>([]);
    const [minMission, setMinMission] = useState<number>(0);
    const [sortChecked, setSortChecked] = useState<boolean>(true);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileUpload = (content: string) => {
        setFileContent(content);
    };

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

    const extractWords = async () => {
        try {
            if (fileContent) {
                setLoading(true);
                await new Promise(resolve => setTimeout(resolve, 1))
                const words: string[] = [];
                for (const word of fileContent.split('\n')) {
                    // 카운터로 미션 카운트
                    const counter = new Counter<string>();
                    for (const c of 'abcdefghijklmnopqrstuvwxyz') {
                        // 최소 미션 글자수 보다 큰 것만 저장
                        if ([...word].filter((char) => char === c).length >= minMission)
                            counter.set(c, [...word].filter((char) => char === c).length)
                    }

                    // 미션 글자: 카운트 표시 정렬 처리
                    const aa = sortChecked ? counter.entries().sort((a, b) => b[1] - a[1]) : counter.entries();

                    // 결과 저장
                    if (aa.length > 0) {
                        words.push(`${word} [${aa.map(([key, value]) => `${key}:${value}`).join(" ")}]`);
                    }
                }
                setExtractedWords(words);
                setLoading(false);
            }
        } catch (err) {
            setLoading(false);
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `EN_MISSION | ${fileContent}`
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `EN_MISSION | ${fileContent}`
                });
            }
        }
    };

    const downloadExtractedWords = () => {
        try {
            if (extractedWords.length === 0) return;
            const blob = new Blob([extractedWords.join("\n")], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${file?.name.substring(0, file?.name.lastIndexOf(".")) || "unknown"}_미션단어목록.txt`;
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
                                    영어 미션단어 추출
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    텍스트 파일에서 영어 미션단어를 추출합니다
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Link href="/manager-tool/extract">
                                <Button variant="outline" size="sm">
                                    <Home className="w-4 h-4" />
                                    도구홈
                                </Button>
                            </Link>
                            <HelpModal
                                title="영어 미션단어 추출 사용법"
                                triggerText="도움말"
                                triggerClassName="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground [&_span]:text-xs [&_svg]:size-4"
                            >
                                <div className="space-y-6">
                                    {/* Step 0 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">0</span>
                                            <h3 className="font-semibold dark:text-white">텍스트 파일을 업로드 합니다.</h3>
                                        </div>
                                    </div>

                                    {/* Step 1 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">1</span>
                                            <h3 className="font-semibold dark:text-white">설정</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p className="dark:text-gray-300">미션글자가 최수 몇개 이상 포함되어 있어야 하는지 입력합니다.</p>
                                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium dark:text-gray-200">최소포함수</Label>
                                                    <Input placeholder="최소포함수를 입력하세요" className="h-8" disabled />
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox disabled checked />
                                                        <Label className="text-sm dark:text-gray-200">결과 정렬</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">2</span>
                                            <h3 className="font-semibold dark:text-white">실행</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p className="dark:text-gray-300">실행 버튼을 누르고 기다립니다.</p>
                                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
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
                                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-medium">3</span>
                                            <h3 className="font-semibold dark:text-white">결과 확인 및 다운로드</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p className="dark:text-gray-300">결과를 확인한 후 다운로드합니다.</p>
                                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
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
                                        <h3 className="font-semibold dark:text-white">사용 예시</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">입력:</p>
                                                <pre className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200 p-3 rounded text-xs overflow-x-auto">
                                                    error
                                                    computer
                                                    nano
                                                    emotionlessness
                                                    enantioconvergence
                                                    eurobabble
                                                </pre>
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">최소포함수: 1 추출</div>
                                                    <div className="text-2xl dark:text-gray-300">↓</div>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">추출 결과:</p>
                                                <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-700">
                                                    <div className="text-sm space-y-1 dark:text-green-200">
                                                        <div>• error [r:3 e:1 o:1]</div>
                                                        <div>• computer [c:1 e:1 m:1 o:1 p:1 r:1 t:1 u:1]</div>
                                                        <div>• nano [n:2 a:1 o:1]</div>
                                                        <div>• emotionlessness [s:4 e:3 n:2 o:2 i:1 l:1 m:1 t:1]</div>
                                                        <div>• enantioconvergence [e:4 n:4 c:2 o:2 a:1 g:1 i:1 r:1 t:1 v:1]</div>
                                                        <div>• eurobabble [b:3 e:2 a:1 l:1 o:1 r:1 u:1]</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-700">
                                        <p className="text-blue-800 dark:text-blue-200 text-sm">
                                            <strong>💡 팁:</strong> 정렬 옵션을 체크하면 결과가 가나다순으로 정렬됩니다.
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
                            resultTitle="미션 단어 목록"
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
                                    <div className="space-y-2">
                                        <Label htmlFor="min-mission" className="dark:text-gray-200">최소 포함수</Label>
                                        <Input
                                            id="min-mission"
                                            type="number"
                                            value={minMission}
                                            onChange={(e) => setMinMission(Math.max(Number(e.target.value), 0))}
                                            placeholder="최소 포함수를 입력하세요"
                                            min={0}
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="sort-option"
                                            checked={sortChecked}
                                            onCheckedChange={(checked) => setSortChecked(checked as boolean)}
                                        />
                                        <Label
                                            htmlFor="sort-option"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                                        >
                                            결과 정렬
                                        </Label>
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