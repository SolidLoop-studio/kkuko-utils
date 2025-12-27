"use client";
import React, { useState } from "react";
import ErrorModal from "@/app/components/ErrModal";
import type { ErrorMessage } from '@/app/types/type'
import Spinner from "@/app/components/Spinner";
import FileContentDisplay from "../components/FileContentDisplay";
import DuemLaw from "@/app/lib/hangulUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Download, Play, Settings, Zap, Home } from "lucide-react";
import HelpModal from "./HelpModal";
import Link from "next/link";
import HelpModalA from "@/app/components/HelpModal";
import { Checkbox } from "@/app/components/ui/checkbox";

const LoopWordExtractorApp = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [extractedWords, setExtractedWords] = useState<string[]>([]);
    const [wordMod, setWordMod] = useState<"mode1" | "mode2" | "mode3" | "mode4" | "">('');
    const [loopLetter, setLoopLetter] = useState<string>('');
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [loading, setLoading] = useState(false);
    const [sortChecked, setSortChecked] = useState<boolean>(true);

    // 파일 업로드 처리
    const handleFileUpload = (content: string) => {
        setFileContent(content.replace(/\r/g, "").replace(/\s+$/, "").replaceAll("\u200b", ""));
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

    // 돌림단어 추출
    const extractWords = async () => {
        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 1));

            if (!fileContent || !loopLetter) return;

            switch (wordMod) {
                case 'mode1':
                    const words1 = fileContent.split(/\s+/).filter(word => word.startsWith(loopLetter) && word.endsWith(loopLetter));
                    setExtractedWords(sortChecked ? words1.sort((a, b) => a.localeCompare(b, 'ko')) : words1);
                    break;
                case 'mode2':
                    const loopl2 = DuemLaw(loopLetter[0]);
                    const words2 = fileContent.split(/\s+/).filter(word => (word.startsWith(loopLetter) || word.startsWith(loopl2)) && word.endsWith(loopLetter));
                    setExtractedWords(sortChecked ? words2.sort((a, b) => a.localeCompare(b, 'ko')) : words2);
                    break;
                case 'mode3':
                    const loopl3 = DuemLaw(loopLetter[0]);
                    const words3 = fileContent.split(/\s+/).filter(word => word.startsWith(loopLetter) && (word.endsWith(loopLetter) || word.endsWith(loopl3)));
                    setExtractedWords(sortChecked ? words3.sort((a, b) => a.localeCompare(b, 'ko')) : words3);
                    break;
                case 'mode4':
                    const loopl4 = DuemLaw(loopLetter[0]);
                    const words4 = fileContent.split(/\s+/).filter(word => (word.startsWith(loopLetter) || word.startsWith(loopl4)) && (word.endsWith(loopLetter) || word.endsWith(loopl4)));
                    setExtractedWords(sortChecked ? words4.sort((a, b) => a.localeCompare(b, 'ko')) : words4);
                    break;
            }
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
            link.download = `${file?.name.substring(0, file?.name.lastIndexOf(".")) || "unknown"}_돌림단어목록.txt`;
            link.click();
        } catch (err) {
            handleError(err);
        }
    };

    // 모드 설명
    const getModeDescription = (mode: string) => {
        switch (mode) {
            case 'mode1': return '시작=끝';
            case 'mode2': return '시작(두음법칙)=끝';
            case 'mode3': return '시작=끝(두음법칙)';
            case 'mode4': return '시작(두음법칙)=끝(두음법칙)';
            default: return '';
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
                                    돌림단어 추출
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    텍스트 파일에서 돌림단어들을 추출합니다
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
                            <HelpModalA
                                title="돌림단어 추출 사용법"
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
                                            <p>원하는 돌림글자를 입력합니다. (예: &quot;라&quot;, &quot;기&quot;)</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">돌림글자</Label>
                                                    <Input placeholder="돌림글자를 입력하세요" className="h-8" disabled />
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox disabled checked />
                                                        <Label className="text-sm">결과 정렬</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">2</span>
                                            <h3 className="font-semibold">모드</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p>추출모드를 선택합니다.</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <RadioGroup
                                                    disabled
                                                    className="space-y-2"
                                                >
                                                    {[
                                                        { value: 'mode1', label: '모드 1', description: '시작=끝' },
                                                        { value: 'mode2', label: '모드 2', description: '시작(두음 ok)=끝' },
                                                        { value: 'mode3', label: '모드 3', description: '시작=끝(두음 ok)' },
                                                        { value: 'mode4', label: '모드 4', description: '시작(두음 ok)=끝(두음 ok)' }
                                                    ].map((mode) => (
                                                        <div key={mode.value} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={mode.value} id={mode.value} />
                                                            <Label
                                                                className="flex-1 cursor-pointer"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-medium">{mode.label}</span>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {mode.description}
                                                                    </span>
                                                                </div>
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">3</span>
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

                                    {/* Step 4 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">4</span>
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
                                            사용예시는 &quot;추출모드&quot; 글자옆의 ?버튼 눌러 확인하세요.
                                        </div>
                                    </div>

                                    <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-blue-800 text-sm">
                                            <strong>💡 팁:</strong> 정렬 옵션을 체크하면 결과가 가나다순으로 정렬됩니다.
                                        </p>
                                    </div>
                                </div>
                            </HelpModalA>
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
                            resultTitle="돌림단어 목록"
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
                                        <Label htmlFor="loop-letter" className="dark:text-gray-200">돌림글자</Label>
                                        <Input
                                            id="loop-letter"
                                            type="text"
                                            value={loopLetter}
                                            onChange={(e) => setLoopLetter(e.target.value)}
                                            placeholder="돌림글자를 입력하세요"
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

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium dark:text-gray-200">추출 모드</Label>
                                            <HelpModal/>
                                        </div>
                                        <RadioGroup
                                            value={wordMod}
                                            onValueChange={(value) => setWordMod(value as typeof wordMod)}
                                            className="space-y-2"
                                        >
                                            {[
                                                { value: 'mode1', label: '모드 1', description: '시작=끝' },
                                                { value: 'mode2', label: '모드 2', description: '시작(두음 ok)=끝' },
                                                { value: 'mode3', label: '모드 3', description: '시작=끝(두음 ok)' },
                                                { value: 'mode4', label: '모드 4', description: '시작(두음 ok)=끝(두음 ok)' }
                                            ].map((mode) => (
                                                <div key={mode.value} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={mode.value} id={mode.value} data-testid={`test-${mode.value}`}/>
                                                    <Label
                                                        htmlFor={mode.value}
                                                        className="flex-1 cursor-pointer dark:text-gray-200"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">{mode.label}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {mode.description}
                                                            </span>
                                                        </div>
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
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
                                        disabled={!fileContent || !loopLetter || !wordMod || loading}
                                    >
                                        <Play className="w-4 h-4 mr-2" />
                                        {loading ? "처리중..." : "돌림단어 추출"}
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
                                                {fileContent.split(/\s+/).length}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                파일의 총 단어 수
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Selected Mode Info */}
                            {wordMod && (
                                <Card className="dark:bg-gray-800 dark:border-gray-700">
                                    <CardContent className="pt-6">
                                        <div className="text-center space-y-2">
                                            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                                                {getModeDescription(wordMod)}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                선택된 추출 모드
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

export default LoopWordExtractorApp;