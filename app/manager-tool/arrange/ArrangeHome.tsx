"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiArrowLeft, FiArrowRight, FiSettings, FiTrash2, FiEdit2, FiAlignLeft, FiType } from 'react-icons/fi';
import HelpModal from "./HelpModal";
import ErrorModal from "@/app/components/ErrModal";
import type { ErrorMessage } from '@/app/types/type'
import Spinner from "@/app/components/Spinner";
import CodeMirror from '@uiw/react-codemirror';
import { FileUp, Download, FilePlus, Trash2 } from 'lucide-react';
import HelpModalA from '@/app/components/HelpModal';
import { useTheme } from 'next-themes'

const FileSector = ({ fileContent, fileInputRef, handleFileUpload, file, lineCount, setFile, setLineCount, setFileContent }: {
    fileContent: string;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    file: File | null;
    lineCount: number;
    setFile: React.Dispatch<React.SetStateAction<File | null>>;
    setLineCount: React.Dispatch<React.SetStateAction<number>>;
    setFileContent: React.Dispatch<React.SetStateAction<string>>
}) => {
    // 에디터 내용
    const [editorContent, setEditorContent] = useState(fileContent);
    const { theme } = useTheme();

    // 파일 콘텐츠 변경되면 업데이트
    useEffect(() => {
        setEditorContent(fileContent);
    }, [fileContent]);

    // 파일 다운로드 처리
    const handleDownload = () => {
        const blob = new Blob([editorContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const today = new Date();
        const formattedDate = `${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        a.download = `${file?.name.split(".")[0] || 'document'}_${formattedDate}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // 파일 삭제
    const clearFile = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            setEditorContent("");
            setFile(null)
            setLineCount(0)
        }
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
            {/* 헤더 */}
            <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    파일 에디터
                </h2>
            </div>

            {/* 파일 업로드 영역 */}
            <div className="p-4 bg-white dark:bg-gray-800">
                <div className="flex items-center">
                    <div className="relative flex-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="file-upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleFileUpload}
                            accept=".txt"
                        />
                        <div className="flex items-center space-x-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-500 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                            <FileUp size={20} />
                            <span className="text-sm">
                                {file ? file.name : '파일을 업로드하세요 (.txt)'}
                            </span>
                        </div>
                    </div>

                    {file && (
                        <button
                            onClick={clearFile}
                            className="ml-2 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                            title="파일 제거"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* 에디터 영역 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2">
                        <FilePlus size={18} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">에디터</span>
                    </div>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">
                        {lineCount} 줄
                    </span>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <CodeMirror
                        value={editorContent}
                        height="400px"
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        extensions={[]}
                        onChange={(value) => {
                            setEditorContent(value);
                            setFileContent(value)
                        }}
                        className="text-sm"
                    />
                </div>
            </div>

            {/* 액션 버튼 */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <button
                    className="flex items-center justify-center space-x-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!editorContent}
                    onClick={handleDownload}
                >
                    <Download size={18} />
                    <span>파일 다운로드</span>
                </button>
            </div>
        </div>
    );
};


const ToolSector = ({ fileContent, setFileContent, setLineCount, seterrorModalView }:
    {
        fileContent: string,
        setFileContent: React.Dispatch<React.SetStateAction<string>>,
        setLineCount: React.Dispatch<React.SetStateAction<number>>,
        seterrorModalView: React.Dispatch<React.SetStateAction<ErrorMessage | null>>
    }
) => {
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);
    const [replaceTarget, setReplaceTarget] = useState<string>("");
    const [replaceValue, setReplaceValue] = useState<string>("");
    const [removeWord, setRemoveWord] = useState<string>("");
    const [replaceOpen, setReplaceOpen] = useState<boolean>(false);
    const [patternToDelete, setPatternToDelete] = useState<string>("");

    // 도구 스택 undo푸시 함수
    const pushToUndoStack = (content: string) => {
        try {
            setUndoStack((prev) => [...prev, content]);
            setRedoStack([]);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `UNDO | ${content}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `UNDO | ${content}`
                });
            }
        }
    };

    const handleUndo = () => {
        try {
            if (undoStack.length > 0) {
                const previousContent = undoStack[undoStack.length - 1];
                setUndoStack((prev) => prev.slice(0, -1));
                setRedoStack((prev) => [fileContent, ...prev]); // 현재 상태를 Redo 스택에 저장
                setFileContent(previousContent); // 이전 상태로 복원
                setLineCount(previousContent.split("\n").length);
            }
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `UNDO | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `UNDO | ${fileContent}`
                });
            }
        }
    };

    const handleRedo = () => {
        try {
            if (redoStack.length > 0) {
                const nextContent = redoStack[0];
                setRedoStack((prev) => prev.slice(1));
                setUndoStack((prev) => [...prev, fileContent]); // 현재 상태를 Undo 스택에 저장
                setFileContent(nextContent); // Redo 상태로 복원
                setLineCount(nextContent.split("\n").length);
            }
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `REDO | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `REDO | ${fileContent}`
                });
            }
        }
    };

    // 공백을 줄바꿈으로 바꾸기
    const handleReplaceSpacesWithNewlines = () => {
        try {
            const updatedContent = fileContent.replace(/ +/g, "\n");
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `ReplaceSpacesWithNewlines | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `ReplaceSpacesWithNewlines | ${fileContent}`
                });
            }
        }
    };

    // 빈줄 삭제
    const handleRemoveEmptyLines = () => {
        try {
            const updatedContent = fileContent
                .split("\n")
                .filter((line) => line.trim() !== "")
                .join("\n");
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `RemoveEmptyLines | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `RemoveEmptyLines | ${fileContent}`
                });
            }
        }
    };

    // 단어 삭제
    const handleRemoveWord = (word: string) => {
        try {
            const updatedContent = fileContent
                .split("\n")
                .map((line) => line.replaceAll(word, ""))
                .join("\n");
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
            setRemoveWord("");
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `RemoveWord | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `RemoveWord | ${fileContent}`
                });
            }
        }
    };

    // replace처리 
    const handleReplaceCharacter = (target: string, replacement: string) => {
        try {
            const updatedContent = fileContent.replaceAll(target, replacement);
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
            setReplaceTarget("");
            setReplaceValue("");
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `ReplaceCharacter | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `ReplaceCharacter | ${fileContent}`
                });
            }
        }
    };

    // 중복 제거
    const handleRemoveDuplicates = () => {
        try {
            const okSet = new Set<string>();
            const temp: string[] = [];
            for (const w of fileContent.split("\n")) {
                if (okSet.has(w)) continue;
                okSet.add(w);
                temp.push(w);
            }
            const updatedContent = temp.join("\n");
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(temp.length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `RemoveDuplicates | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `RemoveDuplicates | ${fileContent}`
                });
            }
        }
    };

    // 정렬 v1
    const handleSortWordv1 = () => {
        try {
            const updatedContent = fileContent.split("\n").sort((a, b) => a.localeCompare(b, "ko-KR"));
            if (updatedContent.join('\n') === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent.join('\n'));
            setLineCount(updatedContent.length);
            console.log(updatedContent)
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `SortWordv1 | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `SortWordv1 | ${fileContent}`
                });
            }
        }
    };

    // 정렬 v2
    const handleSortWordv2 = () => {
        try {
            let groupedText = '';
            let currentChar: string | null = null;
            for (const word of fileContent.split("\n").sort((a, b) => a.localeCompare(b, "ko-KR"))) {
                if (!word || word.includes("=[")) continue;
                const firstChar = word[0].toLowerCase(); // 첫 글자 (대소문자 무시)

                if (currentChar !== firstChar) {
                    // 새로운 그룹의 시작
                    if (currentChar !== null) groupedText += '\n'; // 이전 그룹과 구분
                    groupedText += `=[${firstChar.toUpperCase()}]=\n`;
                    currentChar = firstChar;
                }

                // 현재 단어 추가
                groupedText += word + '\n';
            }
            const updatedContent = groupedText.trim();
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `SortWordv2 | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `SortWordv2 | ${fileContent}`
                });
            }
        }
    };

    // 패턴삭제
    const handleDeleteByPattern = (pattern: string) => {
        try {
            // 정규식 예약 문자들을 이스케이프 처리하는 함수
            const escapeRegExp = (string: string) => {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };

            // ?를 임시 플레이스홀더로 치환
            const tempPattern = pattern.replace(/\?/g, '___WILDCARD___');

            // 나머지 특수문자들을 이스케이프 처리
            const escapedPattern = escapeRegExp(tempPattern);

            // 플레이스홀더를 .+로 치환하여 정규식 패턴 생성
            const regexPattern = escapedPattern.replace(/___WILDCARD___/g, '.+');
            const regex = new RegExp(regexPattern, 'g');

            const updatedContent = fileContent.replace(regex, '');
            if (updatedContent === fileContent) return;

            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
            setPatternToDelete("");
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `DeleteByPattern | ${fileContent}`
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `DeleteByPattern | ${fileContent}`
                });
            }
        }
    };

    // 길이 긴순 정렬
    const handleSortByLength = () => {
        try {
            const updatedContent = fileContent.split("\n").sort((a, b) => b.length - a.length);
            if (updatedContent.join('\n') === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent.join('\n'));
            setLineCount(updatedContent.length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `SortByLength | ${fileContent}`
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `SortByLength | ${fileContent}`
                });
            }
        }
    };

    // 정렬 v3
    const handleSortWordv3 = () => {
        try {
            const updatedContent = fileContent.split("\n").filter((word)=>word!=="" && !word.includes('=[')).sort((a, b) => {
                const aFirst = a[0];
                const bFirst = b[0];
                if (aFirst === bFirst) {
                    if (a.length === b.length) {
                        return a.localeCompare(b, "ko-KR");
                    }
                    return b.length - a.length;
                }
                return aFirst.localeCompare(bFirst, "ko-KR");
            });
            if (updatedContent.join('\n') === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent.join('\n'));
            setLineCount(updatedContent.length);
            console.log(updatedContent)
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `SortWordv1 | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `SortWordv1 | ${fileContent}`
                });
            }
        }
    };

    // 정렬 v4: v3 방식(앞글자순, 길이별 정렬) + v2처럼 그룹헤더(=[첫글자]=) 추가
    const handleSortWordv4 = () => {
        try {
            const filtered = fileContent.split("\n").filter((word) => word !== "" && !word.includes('=['));
            const sorted = filtered.sort((a, b) => {
                const aFirst = a[0];
                const bFirst = b[0];
                if (aFirst === bFirst) {
                    if (a.length === b.length) return a.localeCompare(b, "ko-KR");
                    return b.length - a.length;
                }
                return aFirst.localeCompare(bFirst, "ko-KR");
            });

            // 그룹핑하여 '=[X]=' 헤더 추가
            let groupedText = '';
            let currentChar: string | null = null;
            for (const word of sorted) {
                if (!word) continue;
                const firstChar = word[0].toLowerCase();
                if (currentChar !== firstChar) {
                    if (currentChar !== null) groupedText += '\n';
                    groupedText += `=[${firstChar.toUpperCase()}]=\n`;
                    currentChar = firstChar;
                }
                groupedText += word + '\n';
            }
            const updatedContent = groupedText.trim();
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `SortWordv4 | ${fileContent}`
                });

            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `SortWordv4 | ${fileContent}`
                });
            }
        }
    };

    const handleConvertToLowercase = () => {
        try {
            const updatedContent = fileContent.toLowerCase();
            if (updatedContent === fileContent) return;
            pushToUndoStack(fileContent);
            setFileContent(updatedContent);
            setLineCount(updatedContent.split("\n").length);
        } catch (err) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: `ConvertToLowercase | ${fileContent}`
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: `ConvertToLowercase | ${fileContent}`
                });
            }
        }
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-lg overflow-auto max-h-screen">
            {/* 헤더 */}
            <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h1 className="flex items-center text-2xl font-bold text-gray-800 dark:text-gray-100">
                    <FiSettings className="mr-2 text-blue-500" />
                    도구
                </h1>
                <div className="flex items-center">
                    <div>
                        <HelpModalA
                            title="도구 사용 가이드"
                            triggerClassName="relative cursor-pointer hover:opacity-80 transition-opacity"
                            triggerText="도움말"
                        >
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">📝 편집 기록</h3>
                                    <ul className="space-y-1 text-sm">
                                        <li>• <strong>실행 취소:</strong> 이전 작업을 되돌립니다.</li>
                                        <li>• <strong>다시 실행:</strong> 취소한 작업을 다시 실행합니다.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">🔤 정렬 도구</h3>
                                    <ul className="space-y-1 text-sm">
                                        <li>• <strong>ㄱㄴㄷ순 정렬 v1:</strong> 한글 가나다순으로 정렬합니다.</li>
                                        <li>• <strong>ㄱㄴㄷ순 정렬 v2:</strong> 한글 가나다순으로 정렬하고 알파벳별로 그룹화합니다.</li>
                                        <li>• <strong>ㄱㄴㄷ순 정렬 v3:</strong> 한글 앞글자순으로 정렬하고 길이별로 정렬합니다.</li>
                                        <li>• <strong>ㄱㄴㄷ순 정렬 v4:</strong> v3 방식(앞글자순 + 길이별)으로 정렬하고, 결과를 알파벳별로 그룹화하여 <code>=[첫글자]=</code> 헤더를 추가합니다.</li>
                                        <li>• <strong>길이 긴순 정렬:</strong> 단어의 길이가 긴 순서로 정렬합니다.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">✏️ 내용 편집</h3>
                                    <ul className="space-y-1 text-sm">
                                        <li>• <strong>단어 제거:</strong> 일치하는 단어를 텍스트파일에서 제거합니다.</li>
                                        <li>• <strong>중복 제거:</strong> 중복된 단어들을 삭제합니다.</li>
                                        <li>• <strong>빈 줄 제거:</strong> 빈줄을 삭제합니다.</li>
                                        <li>• <strong>공백 → 줄바꿈:</strong> 공백을 줄바꿈으로 바꿉니다. 이 웹사이트의 대부분 내용들은 줄바꿈을 한 단어로 인식합니다.</li>
                                        <li>• <strong>영어 대 → 소:</strong> 영어 대문자를 소문자로 변환합니다.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">🔍 패턴 삭제</h3>
                                    <p className="text-sm mb-2">간단한 패턴을 사용해 텍스트를 삭제합니다.</p>
                                    <ul className="space-y-1 text-sm mb-2">
                                        <li>• <strong>?</strong>: 하나 이상의 임의 문자를 의미합니다.</li>
                                    </ul>
                                    <div className="bg-gray-100 p-3 rounded text-sm">
                                        <p className="font-medium">예시:</p>
                                        <p><strong>패턴:</strong> [?]</p>
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-600">입력 파일:</p>
                                            <code className="bg-white px-2 py-1 rounded">안녕하세요 [abc] 반갑습니다 [def] 감사합니다</code>
                                        </div>
                                        <div className="mt-1">
                                            <p className="text-xs text-gray-600">출력 결과:</p>
                                            <code className="bg-white px-2 py-1 rounded">안녕하세요  반갑습니다  감사합니다</code>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">🔧 특정 문자 교체</h3>
                                    <p className="text-sm mb-2">특정문자를 바꿉니다.</p>
                                    <div className="bg-gray-100 p-3 rounded text-sm">
                                        <p className="font-medium">예시1:</p>
                                        <p><strong>대상:</strong> =</p>
                                        <p><strong>대체값:</strong> 비워둠 (비워두면 기본값으로 다 공백으로 치환합니다.)</p>
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-600">입력 파일:</p>
                                            <code className="bg-white px-2 py-1 rounded">가=나다라마바사</code>
                                        </div>
                                        <div className="mt-1">
                                            <p className="text-xs text-gray-600">출력 결과:</p>
                                            <code className="bg-white px-2 py-1 rounded">가나다라마바사</code>
                                        </div>
                                    </div>
                                    <div className="bg-gray-100 p-3 rounded text-sm">
                                        <p className="font-medium">예시2:</p>
                                        <p><strong>대상:</strong> =</p>
                                        <p><strong>대체값:</strong> X</p>
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-600">입력 파일:</p>
                                            <code className="bg-white px-2 py-1 rounded">가=나다라마바사</code>
                                        </div>
                                        <div className="mt-1">
                                            <p className="text-xs text-gray-600">출력 결과:</p>
                                            <code className="bg-white px-2 py-1 rounded">가X나다라마바사</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </HelpModalA>
                    </div>
                </div>
            </div>

            {/* 도구 목록 */}
            <div className="p-4 space-y-4">
                {/* Undo / Redo 영역 */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                        <FiEdit2 className="mr-2 text-blue-500" />
                        편집 기록
                    </h2>
                    <div className="flex gap-2">
                        <button
                            className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium flex-1 transition-colors ${undoStack.length > 0
                                ? "bg-blue-500 text-white hover:bg-blue-600"
                                : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                                }`}
                            onClick={handleUndo}
                            disabled={undoStack.length === 0}
                        >
                            <FiArrowLeft className="mr-2" />
                            실행 취소
                        </button>
                        <button
                            className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium flex-1 transition-colors ${redoStack.length > 0
                                ? "bg-blue-500 text-white hover:bg-blue-600"
                                : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                                }`}
                            onClick={handleRedo}
                            disabled={redoStack.length === 0}
                        >
                            <FiArrowRight className="mr-2" />
                            다시 실행
                        </button>
                    </div>
                </div>

                {/* 정렬 도구 */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                        <FiAlignLeft className="mr-2 text-green-500" />
                        정렬 도구
                    </h2>

                    <div className="space-y-3">
                        {/* ㄱㄴㄷ 순 정렬 v1 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">ㄱㄴㄷ 순 정렬 v1:</span>
                            <button
                                className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleSortWordv1}  // handleSortWordv1 함수 연결 필요
                            >
                                정렬하기
                            </button>
                            <div className="w-6 h-6 relative cursor-pointer hover:opacity-80 transition-opacity">
                                <HelpModal wantGo={2} />
                            </div>
                        </div>

                        {/* ㄱㄴㄷ 순 정렬 v2 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">ㄱㄴㄷ 순 정렬 v2:</span>
                            <button
                                className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleSortWordv2}  // handleSortWordv2 함수 연결 필요
                            >
                                정렬하기
                            </button>
                            <div className="w-6 h-6 relative cursor-pointer hover:opacity-80 transition-opacity">
                                <HelpModal wantGo={3} />
                            </div>
                        </div>

                        {/* ㄱㄴㄷ 순 정렬 v3 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50
                            dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">ㄱㄴㄷ 순 정렬 v3:</span>
                            <button
                                className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleSortWordv3}  // handleSortWordv3 함수 연결 필요
                            >
                                정렬하기
                            </button>
                            <div className="w-6 h-6 relative cursor-pointer hover:opacity-80 transition-opacity">
                                <HelpModal wantGo={4} />
                            </div>
                        </div>

                        {/* ㄱㄴㄷ 순 정렬 v4 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50
                            dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">ㄱㄴㄷ 순 정렬 v4:</span>
                            <button
                                className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleSortWordv4}
                            >
                                정렬하기
                            </button>
                            <div className="w-6 h-6 relative cursor-pointer hover:opacity-80 transition-opacity">
                                <HelpModal wantGo={5} />
                            </div>
                        </div>

                        {/* 길이 긴순 정렬 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50
                            dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">길이 긴 순 정렬:</span>
                            <button
                                className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleSortByLength}  // handleSortByLength 함수 연결 필요
                            >
                                정렬하기
                            </button>
                        </div>
                    </div>
                </div>

                {/* 내용 편집 도구 */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                        <FiTrash2 className="mr-2 text-red-500" />
                        내용 편집
                    </h2>

                    <div className="space-y-3">
                        {/* 단어 제거 */}
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-auto">단어 제거:</span>
                            <div className="flex flex-1 gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                    placeholder="제거할 단어 입력"
                                    value={removeWord}
                                    onChange={(e) => setRemoveWord(e.target.value)}
                                />
                                <button
                                    className="bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    disabled={!fileContent || !removeWord}
                                    onClick={() => handleRemoveWord(removeWord)}  // handleRemoveWord 함수 연결 필요
                                >
                                    제거하기
                                </button>
                            </div>
                        </div>

                        {/* 중복 제거 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">중복 제거:</span>
                            <button
                                className="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleRemoveDuplicates}  // handleRemoveDuplicates 함수 연결 필요
                            >
                                중복 제거하기
                            </button>
                        </div>

                        {/* 빈 줄 제거 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">빈 줄 제거:</span>
                            <button
                                className="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleRemoveEmptyLines}  // handleRemoveEmptyLines 함수 연결 필요
                            >
                                빈 줄 제거하기
                            </button>
                        </div>

                        {/* 공백 -> 줄바꿈 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">공백 → 줄바꿈:</span>
                            <button
                                className="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleReplaceSpacesWithNewlines}  // handleReplaceSpacesWithNewlines 함수 연결 필요
                            >
                                변환하기
                            </button>
                        </div>
                        {/* 패턴 삭제 */}
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-auto">패턴 삭제:</span>
                            <div className="flex flex-1 gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
                                    placeholder="패턴 입력 (예: [?] - ?는 임의 문자)"
                                    value={patternToDelete}
                                    onChange={(e) => setPatternToDelete(e.target.value)}
                                />
                                <button
                                    className="bg-orange-500 text-white px-3 py-1.5 rounded-md hover:bg-orange-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    disabled={!fileContent || !patternToDelete}
                                    onClick={() => handleDeleteByPattern(patternToDelete)}
                                >
                                    삭제하기
                                </button>
                            </div>
                        </div>
                        {/* 영어 대문자 -> 소문자 */}
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">영어 대 → 소:</span>
                            <button
                                className="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent}
                                onClick={handleConvertToLowercase} 
                            >
                                변환하기
                            </button>
                        </div>
                    </div>
                </div>

                {/* 특정 문자 교체 */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                            <FiType className="mr-2 text-purple-500" />
                            특정 문자 교체
                        </h2>
                        <button
                            className="flex items-center text-purple-500 hover:text-purple-600 text-sm font-medium"
                            onClick={() => setReplaceOpen((prev) => !prev)}
                        >
                            {replaceOpen ? "접기" : "펼치기"}
                        </button>
                    </div>

                    {replaceOpen && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md space-y-3 mt-2">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대상 문자:</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-200"
                                    placeholder="대상 문자 입력"
                                    value={replaceTarget}
                                    onChange={(e) => setReplaceTarget(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대체 문자:</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-200"
                                    placeholder="대체 문자 입력 (빈 값 가능)"
                                    value={replaceValue}
                                    onChange={(e) => setReplaceValue(e.target.value)}
                                />
                            </div>
                            <button
                                className="w-full bg-purple-500 text-white px-3 py-2 rounded-md hover:bg-purple-600 text-sm font-medium transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={!fileContent || !replaceTarget}
                                onClick={() => handleReplaceCharacter(replaceTarget, replaceValue)}  // handleReplaceCharacter 함수 연결 필요
                            >
                                문자 교체하기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ArrangeHome = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [lineCount, setLineCount] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (file) {
            setFile(file);
            // Check if the file is a .txt file
            if (file.type === "text/plain") {
                const reader = new FileReader();

                // Read the file as text
                reader.onload = (e) => {
                    const text = e.target?.result;
                    if (typeof text === "string") {
                        setFileContent(text.replace(/\r/g, "").replace(/\s+$/, "").replaceAll("\u200b", "")); // Update state with file content
                        setLineCount(text.split("\n").length); // Count lines
                        setLoading(false);
                    }
                    else {
                        throw new Error('fail to read file');
                    }

                };

                reader.onerror = (event) => {
                    const error = event.target?.error;
                    try {
                        if (error) {
                            const errorObj = new Error(`FileReader Error: ${error.message}`);
                            errorObj.name = error.name; // DOMException의 name 속성을 Error 객체에 복사
                            throw errorObj;
                        }
                    } catch (err) {
                        if (err instanceof Error) {
                            seterrorModalView({
                                ErrName: err.name,
                                ErrMessage: err.message,
                                ErrStackRace: err.stack,
                                inputValue: null
                            });

                        } else {
                            seterrorModalView({
                                ErrName: null,
                                ErrMessage: null,
                                ErrStackRace: err as string,
                                inputValue: null
                            });
                        }
                    } finally {
                        setLoading(false);
                    }
                };
                setLoading(true);
                reader.readAsText(file, "utf-8");


            } else {
                alert("지원되지 않는 파일 형식입니다. UTF-8 형식의 .txt 파일만 업로드해주세요.");
            }
        }
    };



    return (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* 파일 관련 */}
            <div className="w-full md:w-3/5 bg-blue-100 dark:bg-blue-900 p-4 flex flex-col gap-3 h-auto md:h-full overflow-y-auto">
                <FileSector
                    fileContent={fileContent}
                    fileInputRef={fileInputRef}
                    handleFileUpload={handleFileUpload}
                    file={file}
                    lineCount={lineCount}
                    setFile={setFile}
                    setLineCount={setLineCount}
                    setFileContent={setFileContent}
                />
            </div>

            {/* 도구 관련 */}
            <div className="w-full md:flex-1 bg-green-100 dark:bg-green-900 p-6 overflow-y-auto h-auto md:h-full">
                <ToolSector
                    fileContent={fileContent}
                    setFileContent={setFileContent}
                    setLineCount={setLineCount}
                    seterrorModalView={seterrorModalView}
                />
            </div>

            {errorModalView && <ErrorModal onClose={() => seterrorModalView(null)} error={errorModalView} />}
            {loading && (
                <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-50">
                    <Spinner />
                </div>
            )}
        </div>
    );
};

export default ArrangeHome;
