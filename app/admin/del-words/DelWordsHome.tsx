"use client";
import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Textarea } from '@/app/components/ui/textarea';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { PostgrestError } from '@supabase/supabase-js';
import ErrorModal from "@/app/components/ErrModal";
import { SCM } from '@/app/lib/supabaseClient';
import { useSelector } from 'react-redux';
import { RootState } from "@/app/store/store";
import { chunk as chunkArray } from "es-toolkit";
import Link from "next/link";

function isNumericString(str: string): boolean {
    return /^[0-9]+$/.test(str);
}

const keya = (word: string, themeName: string) => `[${word}, ${themeName}]`

export default function WordsDelHome() {
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [fileContent, setFileContent] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [currentTask, setCurrentTask] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [processingComplete, setProcessingComplete] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);
    const user = useSelector((state: RootState) => state.user);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const makeError = (error: PostgrestError) => {
        setErrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.code,
            inputValue: "admin"
        })
        setIsProcessing(false)
    }


    const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name);

            // 파일 내용 읽기
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>): void => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    setFileContent(result);
                }
            };
            reader.readAsText(selectedFile);

            // 초기화
            setProcessingComplete(false);
            setError('');
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            setFileName(droppedFile.name);

            // 파일 내용 읽기
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>): void => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    setFileContent(result);
                }
            };
            reader.readAsText(droppedFile);

            // 초기화
            setProcessingComplete(false);
            setError('');
        }
    };

    const handleUploadClick = (): void => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleProcess = async () => {
        if (!file) {
            setError('처리할 파일을 먼저 업로드해주세요.');
            return;
        }

        // 처리 시작
        setIsProcessing(true);
        setShowModal(true);
        setProgress(0);
        setCurrentTask('파일 분석 중...');

        await handleDbProcess();
    };

    const handleDbProcess = async () => {
        if (!fileContent || !user.uuid) return setIsProcessing(false);
        const words = fileContent.split('\n').map(line => line.replace(/\r$/, ''));


        setCurrentTask("필요한 정보 가져오는 중...");
        setProgress(0);
        const { data: docsData, error: docsDataError } = await SCM.get().allDocs();
        if (docsDataError) return makeError(docsDataError);

        const { data: waitWords, error: waitWordsError } = await SCM.get().allWaitWords('delete');
        const { data: waitThemeWord, error: waitThemeWordError } = await SCM.get().allWordWaitTheme('delete');

        if (waitWordsError) { return makeError(waitWordsError); }
        if (waitThemeWordError) { return makeError(waitThemeWordError); }

        const { data: waitWordTheme, error: waitWordThemeError } = await SCM.get().waitWordsThemes(waitWords.map(({ id }) => id))
        if (waitWordThemeError) { return makeError(waitWordThemeError); }

        const waitWord: Record<string, { id: number, requested_by: string | null }> = {};
        const waitTheme: Record<string, { req_by: string | null }> = {};

        waitWords.forEach(({ id, word, requested_by }) => waitWord[word] = { id, requested_by });
        waitThemeWord.forEach(({ words: { word }, themes: { name }, req_by }) => {
            waitTheme[keya(word, name)] = { req_by }
        })
        waitWordTheme.forEach(({ wait_words: { word }, themes: { name } }) => {
            waitTheme[keya(word, name)] = { req_by: waitWord[word]?.requested_by ?? null }
        })

        const letterDocsInfo: Record<string, number> = {};
        const themeDocsInfo: Record<string, number> = {};


        docsData.filter(({ typez }) => typez === "letter").forEach(({ id, name }) => {
            letterDocsInfo[name] = id
        })
        docsData.filter(({ typez }) => typez === "theme").forEach(({ id, name }) => {
            themeDocsInfo[name] = id
        })

        const logsQuery: { word: string, processed_by: string, make_by: string, r_type: "delete", state: "approved" }[] = []
        const docsLogsQuery: { docs_id: number, word: string, add_by: string, type: "delete" }[] = []

        setCurrentTask("삭제할 단어 정보 가져오는 중...");
        setProgress(25);
        const wordIds: number[] = [];
        const wordIdMap: Record<number,string> = {}

        const chuckWords = chunkArray(words, 100)
        for (const ww of chuckWords) {
            const { data: wordsData, error: wordsError } = await SCM.get().wordsByWords(ww);
            if (wordsError) return makeError(wordsError);

            for (const data of wordsData) {
                wordIds.push(data.id)
                wordIdMap[data.id] = data.word
            }
        }

        setCurrentTask("삭제할 단어의 주제 정보 가져오는 중...");
        setProgress(50);

        const doct: Record<string,string[]> = {};
        const nodel: Set<number> = new Set();

        for (const chuckchu of chunkArray(wordIds, 100)) {
            const { data: wordThemeData, error: wordThemeError } = await SCM.get().wordsThemes(chuckchu)
            if (wordThemeError) return makeError(wordThemeError)

            for (const data of wordThemeData) {
                if (isNumericString(data.themes.code)){
                    nodel.add(data.words.id)
                }
                doct[data.words.word] = [...(doct[data.words.word] ?? []), data.themes.name]
            }
        }

        const wordIdsAA = wordIds.filter(v=>!nodel.has(v));
        for (const wordId of wordIdsAA){
            const word=wordIdMap[wordId]
            logsQuery.push({
                word: word,
                processed_by: user.uuid,
                make_by: waitWord[word]?.requested_by ?? user.uuid,
                r_type: "delete" as const,
                state: "approved" as const
            })
            const docsId = letterDocsInfo[word[word.length - 1]]
            if (docsId){
                docsLogsQuery.push({
                    docs_id: docsId,
                    word: word,
                    add_by: waitWord[word]?.requested_by ?? user.uuid,
                    type: "delete" as const
                })
            } 
            const t = doct[word] ?? []
            if (t.length > 0){
                for (const tname of t){
                    const tid = themeDocsInfo[tname]
                    docsLogsQuery.push({
                        docs_id: tid,
                        word: word,
                        add_by: waitTheme[keya(word,tname)]?.req_by ?? user.uuid,
                        type: "delete" as const
                    })
                }
            }
            
        }

        setCurrentTask("로그 등록중...");
        setProgress(75);

        const { error: logError } = await SCM.add().wordLog(logsQuery);
        if (logError) return makeError(logError)

        const { error: docsLogError } = await SCM.add().docsLog(docsLogsQuery);
        if (docsLogError) return makeError(docsLogError)
        const docsLogData = docsLogsQuery.map(({docs_id})=>docs_id)

        
        const deleteWordIdChuck = chunkArray(wordIdsAA, 200);
        const updateDocsId: Set<number> = new Set();

        for (let i = 0; i < deleteWordIdChuck.length; i++) {
            const wordIdsA = deleteWordIdChuck[i]
            setCurrentTask(`삭제 처리중... ${i}/${deleteWordIdChuck.length}`)
            const { error: deleteWordError } = await SCM.delete().wordByIds(wordIdsA);
            if (deleteWordError) return makeError(deleteWordError)
        }
        for (const id of docsLogData) {
            updateDocsId.add(id)
        }

        setCurrentTask("마지막 처리중...");
        setProgress(95);
        await SCM.update().docsLastUpdate([...updateDocsId])
        await SCM.update().userContribution({ userId: user.uuid, amount: wordIds.length })
        

        setProgress(100);
        setIsProcessing(false);
        setProcessingComplete(true);
        setCurrentTask('처리 완료!');
    }


    const closeModal = (): void => {
        setShowModal(false);
        setIsProcessing(false);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">단어 대량 삭제 페이지</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">단어를 대량으로 삭제합니다.</p>
            </header>

            <main className="flex-grow">
                {/* 관리자 대시보드로 이동 버튼 */}
                <Link href={'/admin'} className="mb-4 flex">
                    <Button variant="outline">
                        <ArrowLeft />
                        관리자 대시보드로 이동
                    </Button>
                </Link>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-transparent dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">파일 업로드</h2>

                    {/* 드래그 앤 드롭 영역 */}
                    <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-gray-900"
                        onClick={handleUploadClick}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".txt,.csv,.md,.json"
                        />

                        <div className="flex flex-col items-center gap-3">
                            <Upload className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {fileName ? `${fileName} 선택됨` : '파일을 드래그하거나 클릭하여 업로드'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">지원 형식: TXT, CSV, MD, JSON</p>
                        </div>
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* 파일 내용 미리보기 */}
                    {fileContent && (
                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                <FileText className="h-5 w-5" />
                                파일 미리보기
                            </h3>
                            <Textarea
                                value={fileContent.length > 1000 ? `${fileContent.substring(0, 1000)}...` : fileContent}
                                readOnly
                                className="font-mono text-sm h-48 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                    )}

                    {/* 처리 버튼 */}
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleProcess}
                            disabled={!file || isProcessing}
                            className="px-6"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    처리 중...
                                </>
                            ) : '파일 처리'}
                        </Button>
                    </div>
                </div>

                {/* 추가 기능이나 결과를 보여주는 섹션 (필요에 따라 확장) */}
                {processingComplete && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700">
                        <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-6 w-6" />
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">처리 완료!</h2>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                            삭제 처리가 완료되었습니다
                        </p>
                    </div>
                )}
            </main>

            {/* 처리 모달 */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100">
                            {processingComplete ? '처리 완료' : '처리 진행 중'}
                        </DialogTitle>
                        <DialogDescription className="dark:text-gray-300">
                            {processingComplete
                                ? '모든 작업이 성공적으로 완료되었습니다.'
                                : '텍스트 파일을 처리하고 있습니다. 잠시만 기다려주세요.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{currentTask}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />

                        {isProcessing && (
                            <div className="flex justify-center mt-6">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            </div>
                        )}

                        {processingComplete && (
                            <div className="flex justify-center mt-6">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={closeModal}
                            variant={processingComplete ? "default" : "outline"}
                            disabled={isProcessing}
                        >
                            {processingComplete ? '확인' : '취소'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {errorModalView && <ErrorModal error={errorModalView} onClose={() => setErrorModalView(null)} />}
        </div>
    );
}