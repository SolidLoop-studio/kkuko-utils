"use client";
import React, { useState } from "react";
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
import Link from "next/link";
import HelpModal from "@/src/app/components/HelpModal";

const WordExtractorApp = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [extractedWords, setExtractedWords] = useState<string[]>([]);
    const [sortChecked, setSortChecked] = useState<boolean>(true);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [loading, setLoading] = useState(false);
    const [wordInclude, setWordInclude] = useState<string>('');

    const handleFileUpload = (content: string) => {
        setFileContent(content);
    };

    const handleError = (error: unknown) => {
        if (error instanceof Error) {
            seterrorModalView({
                component: 'ContainX',
                ErrName: error.name,
                ErrMessage: error.message,
                ErrStackRace: error.stack,
                inputValue: null
            });
        } else {
            seterrorModalView({
                component: 'ContainX',
                ErrName: null,
                ErrMessage: null,
                ErrStackRace: error as string,
                inputValue: null
            });
        }
    };

    const extractWords = async () => {
        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 1))

            if (fileContent && wordInclude) {
                const uniqueSet = new Set();
                const result: string[] = [];
                const words = fileContent.split(/\s+/);

                words.forEach(word => {
                    const cleanedWord = word.replace(/[.,!?;:()]/g, '');
                    if (cleanedWord && cleanedWord.includes(wordInclude) && !uniqueSet.has(cleanedWord)) {
                        uniqueSet.add(cleanedWord);
                        result.push(cleanedWord);
                    }
                });

                setExtractedWords(sortChecked ? result.sort((a, b) => a.localeCompare(b, "ko")) : result);
            }
        } catch (err) {
            handleError(err);
        } finally {
            setLoading(false)
        }
    };

    const downloadExtractedWords = () => {
        try {
            if (extractedWords.length === 0) return;
            const blob = new Blob([extractedWords.join("\n")], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `extracted_words_${wordInclude}_포함목록.txt`;
            link.click();
        } catch (err) {
            handleError(err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    X가 포함된 단어 추출
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    텍스트 파일에서 특정 문자열이 포함된 단어들을 추출합니다
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
                                title="X가 포함된 단어 추출 사용법"
                                triggerText="도움말"
                                triggerClassName="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground [&_span]:text-xs [&_svg]:size-4"
                            >
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">0</span>
                                            <h3 className="font-semibold">텍스트 파일을 업로드 합니다.</h3>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">1</span>
                                            <h3 className="font-semibold">설정</h3>
                                        </div>
                                        <div className="ml-6 space-y-2">
                                            <p>포함할 글자를 입력합니다. (예: &quot;가&quot;, &quot;미션&quot;)</p>
                                            <div className="bg-gray-50 p-3 rounded-lg border">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">포함글자</Label>
                                                    <Input placeholder="포함글자를 입력하세요" className="h-8" disabled />
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox disabled checked />
                                                        <Label className="text-sm">결과 정렬</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

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

                                    <div className="space-y-3">
                                        <h3 className="font-semibold">사용 예시</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-gray-600 mb-2">입력:</p>
                                                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                                    미션
                                                    가을
                                                    봄날
                                                    겨울
                                                    임무
                                                </pre>
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="text-sm text-gray-500">포함글자: &quot;미&quot; 추출</div>
                                                    <div className="text-2xl">↓</div>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600 mb-2">추출 결과:</p>
                                                <div className="bg-green-50 p-3 rounded border border-green-200">
                                                    <div className="text-sm space-y-1">
                                                        <div>• 미션</div>
                                                        <div>• 미로</div>
                                                    </div>
                                                    <div className="mt-2 text-xs text-green-600">
                                                        총 2개 단어 추출됨
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-blue-800 text-sm">
                                            <strong>💡 팁:</strong> 포함글자에 여러 문자를 입력하면 해당 문자열이 들어간 단어만 추출됩니다.
                                        </p>
                                    </div>
                                </div>
                            </HelpModal>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3">
                        <FileContentDisplay
                            fileContent={fileContent}
                            setFileContent={setFileContent}
                            setFile={setFile}
                            file={file}
                            onFileUpload={handleFileUpload}
                            onError={handleError}
                            resultData={extractedWords}
                            resultTitle={`"${wordInclude || "?"}"가 포함된 단어 목록`}
                        />
                    </div>

                    <div className="xl:col-span-1">
                        <div className="space-y-6">
                            <Card className="dark:bg-gray-800 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 dark:text-white">
                                        <Settings className="h-5 w-5 dark:text-gray-400" />
                                        설정
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="word-include" className="dark:text-gray-200">포함글자</Label>
                                        <Input
                                            id="word-include"
                                            value={wordInclude}
                                            onChange={(e) => setWordInclude(e.target.value)}
                                            placeholder="포함글자를 입력하세요"
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
                                        disabled={!fileContent || loading || !wordInclude}
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

            {errorModalView && (
                <ErrorModal
                    onClose={() => seterrorModalView(null)}
                    error={errorModalView}
                />
            )}

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
