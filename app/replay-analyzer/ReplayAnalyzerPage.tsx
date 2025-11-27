'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Progress } from '@/app/components/ui/progress';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Copy, Download, Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import ReplayParser from '@/app/lib/replayParser';
import { GameEventType } from '@/app/types/replay';
import * as XLSX from 'xlsx';

type FileStatus = 'idle' | 'processing' | 'success' | 'error';

interface AnalyzedFile {
  id: string;
  name: string;
  status: FileStatus;
  words: string[];
  wordAndThemes: { [key: string]: string[] };
  logs: { type: GameEventType | "turnHint"; time: number; userId?: string; message: string; }[];
  roundChains: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }[];
  userMapping: { [userId: string]: number };
  mode: number;
  error?: string;
}

const SUPPORTED_EXTENSIONS = ['.txt', '.json', '.kkt'];

export default function ReplayAnalyzerPage() {
  const [files, setFiles] = useState<AnalyzedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 간단한 피드백을 위해 상태를 추가할 수 있지만, 여기서는 생략
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  const downloadWordsAsTxt = (words: string[], fileName: string) => {
    const content = words.sort().join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_words.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadWordThemesAsXlsx = (wordAndThemes: { [key: string]: string[] }, fileName: string) => {
    const data = Object.entries(wordAndThemes).map(([word, themes]) => ({
      '단어': word,
      '주제': themes.join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '단어와 주제');
    XLSX.writeFile(wb, `${fileName}_word_themes.xlsx`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    const validFiles = Array.from(uploadedFiles).filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(extension);
    });

    if (validFiles.length === 0) {
      alert('지원되는 파일 형식(.txt, .json, .kkt)을 업로드해주세요.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    const newFiles: AnalyzedFile[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileId = Date.now() + i;
      
      try {
        const content = await file.text();
        const parser = new ReplayParser(content);
        
        // 파싱
        const parseResult = parser.parse();
        if (parseResult.error) {
          newFiles.push({
            id: fileId.toString(),
            name: file.name,
            status: 'error',
            words: [],
            wordAndThemes: {},
            logs: [],
            roundChains: [],
            userMapping: {},
            mode: 0,
            error: parseResult.error.name
          });
          continue;
        }

        // 분석
        const analyzeResult = parser.analyzeByMode();
        if (analyzeResult.error) {
          newFiles.push({
            id: fileId.toString(),
            name: file.name,
            status: 'error',
            words: [],
            wordAndThemes: {},
            logs: [],
            roundChains: [],
            userMapping: {},
            mode: 0,
            error: analyzeResult.error.name
          });
          continue;
        }

        newFiles.push({
          id: fileId.toString(),
          name: file.name,
          status: 'success',
          words: analyzeResult.data.words,
          wordAndThemes: analyzeResult.data.wordAndThemes,
          logs: analyzeResult.data.logs,
          roundChains: analyzeResult.data.roundChains,
          userMapping: analyzeResult.data.userMapping,
          mode: analyzeResult.data.mode
        });

      } catch (error) {
        newFiles.push({
          id: fileId.toString(),
          name: file.name,
          status: 'error',
          words: [],
          wordAndThemes: {},
          logs: [],
          roundChains: [],
          userMapping: {},
          mode: 0,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }

      setProcessingProgress((i + 1) / validFiles.length * 100);
    }

    setFiles(prev => [...prev, ...newFiles]);
    setIsProcessing(false);
    setProcessingProgress(0);

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold dark:text-white">끄투코리아 리플레이 분석기</h1>
        <p className="text-gray-600 dark:text-gray-300">게임 리플레이 파일을 업로드하여 단어와 로그를 분석해보세요</p>
      </div>

      {/* 파일 업로드 섹션 */}
      <Card className="dark:bg-gray-700 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Upload className="w-5 h-5" />
            파일 업로드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.json,.kkt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  파일을 클릭하여 업로드하거나 드래그 앤 드롭하세요
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  지원 형식: .txt, .json, .kkt
                </p>
              </label>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm dark:text-gray-300">
                  <span>파일 처리 중...</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 파일 목록 */}
      {files.length > 0 && (
        <Card className="dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="dark:text-white">업로드된 파일</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border dark:border-gray-600 rounded-lg dark:bg-gray-600">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(file.status)}
                    <span className="font-medium dark:text-white">{file.name}</span>
                    {file.status === 'success' && (
                      <Badge variant="secondary" className="dark:bg-gray-500 dark:text-gray-100">{file.words.length}개 단어</Badge>
                    )}
                    {file.status === 'error' && (
                      <Badge variant="destructive">오류</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="dark:text-gray-300 dark:hover:bg-gray-500"
                  >
                    제거
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {files.filter(f => f.status === 'success').map((file) => (
        <Card key={file.id} className="dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="flex items-center justify-between dark:text-white">
              <span>{file.name} - 분석 결과</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadWordsAsTxt(file.words, file.name.replace(/\.[^/.]+$/, ''))}
                  className="dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  단어 목록 다운로드
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadWordThemesAsXlsx(file.wordAndThemes, file.name.replace(/\.[^/.]+$/, ''))}
                  className="dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  단어+주제 XLSX 다운로드
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="words" className="w-full">
              <TabsList className={`grid w-full ${file.mode !== 4 && file.mode !== 11 ? 'grid-cols-3' : 'grid-cols-2'} dark:bg-gray-600`}>
                <TabsTrigger value="words" className="dark:text-gray-200 dark:data-[state=active]:bg-gray-500 dark:data-[state=active]:text-white">단어 목록 ({file.words.length}개)</TabsTrigger>
                {file.mode !== 4 && file.mode !== 11 && (
                  <TabsTrigger value="chains" className="dark:text-gray-200 dark:data-[state=active]:bg-gray-500 dark:data-[state=active]:text-white">연결 그래프 ({file.roundChains.length}라운드)</TabsTrigger>
                )}
                <TabsTrigger value="logs" className="dark:text-gray-200 dark:data-[state=active]:bg-gray-500 dark:data-[state=active]:text-white">게임 로그 ({file.logs.length}개)</TabsTrigger>
              </TabsList>

              <TabsContent value="words" className="space-y-4">
                <ScrollArea className="h-96 w-full border dark:border-gray-600 rounded-md p-4 dark:bg-gray-600">
                  <div className="space-y-2">
                    {file.words.sort().map((word, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-500 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium dark:text-white">{word}</span>
                          {file.wordAndThemes[word] && (
                            <div className="flex gap-1">
                              {file.wordAndThemes[word].map((theme, i) => (
                                <Badge key={i} variant="outline" className="text-xs dark:border-gray-400 dark:text-gray-200">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(word)}
                          className="dark:text-gray-300 dark:hover:bg-gray-400"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {file.mode !== 4 && file.mode !== 11 && (
                <TabsContent value="chains" className="space-y-4">
                  <ScrollArea className="h-96 w-full border dark:border-gray-600 rounded-md p-4 dark:bg-gray-600">
                    <div className="space-y-6">
                      {/* 유저 매핑 표시 */}
                      {Object.keys(file.userMapping).length > 0 && (
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-4">
                          <h4 className="font-semibold text-sm mb-2 dark:text-white">플레이어 번호</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(file.userMapping)
                              .sort((a, b) => a[1] - b[1])
                              .map(([userId, userNum]) => (
                                <Badge key={userId} variant="outline" className="dark:border-gray-400 dark:text-gray-200">
                                  {userNum}번: {userId}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {file.roundChains.map((roundChain: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }, roundIndex: number) => (
                        <div key={roundIndex} className="border-b dark:border-gray-500 pb-4 last:border-b-0">
                          <h3 className="font-semibold text-lg mb-3 dark:text-white">{roundChain.round}라운드</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {roundChain.chains.map((chain: { userId: string; word: string | null; isRoundEnd: boolean }, chainIndex: number) => (
                              <React.Fragment key={chainIndex}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="dark:bg-gray-500 dark:text-gray-100">
                                    {file.userMapping[chain.userId] || '?'}
                                  </Badge>
                                  {chain.isRoundEnd ? (
                                    <span className="text-red-500 font-semibold dark:text-red-400">라운드 종료</span>
                                  ) : (
                                    <span className="font-medium dark:text-white">{chain.word}</span>
                                  )}
                                </div>
                                {chainIndex < roundChain.chains.length - 1 && (
                                  <span className="text-gray-400 dark:text-gray-500">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}

              <TabsContent value="logs" className="space-y-4">
                <ScrollArea className="h-96 w-full border dark:border-gray-600 rounded-md p-4 dark:bg-gray-600">
                  <div className="space-y-2">
                    {file.logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-500 rounded">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono min-w-[50px]">
                          {formatTime(log.time)}
                        </span>
                        <Badge variant="outline" className="text-xs dark:border-gray-400 dark:text-gray-200">
                          {log.type}
                        </Badge>
                        <div className="flex-1">
                          <div className="text-sm dark:text-gray-200">
                            {log.userId && (
                              <span className="font-medium text-blue-600 dark:text-blue-400">#{log.userId}: </span>
                            )}
                            <span>{log.message}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ))}

      {/* 오류 파일들 */}
      {files.filter(f => f.status === 'error').map((file) => (
        <Alert key={file.id} variant="destructive" className="dark:border-red-600 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="dark:text-red-300">
            <strong>{file.name}</strong>: {file.error}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
