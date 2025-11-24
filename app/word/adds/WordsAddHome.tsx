"use client";
import { useState, useRef, useEffect } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import WordAddForm from "@/app/word/components/WordAddFrom";
import { disassemble } from "es-hangul";
import ErrorModal from "@/app/components/ErrModal";
import { Edit2, Plus, Save, X, FileText, Trash2, FileSpreadsheet, AlertCircle, Check} from "lucide-react";
import useSWR from "swr";
import Spinner from "@/app/components/Spinner";
import { chunk as chunkArray } from "es-toolkit";
import CompleteModal from "@/app/components/CompleteModal";
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { fetcher } from "../lib";
import * as XLSX from 'xlsx';
import { PostgrestError } from "@supabase/supabase-js";
import ProgressModal from "@/app/components/ProgressModal";
import { SCM } from "@/app/lib/supabaseClient";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store/store";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";
import HelpModal from '@/app/components/HelpModal';

interface WordEntry {
    id: string;
    word: string;
    topics: string[];
}

interface FileInfo {
    id: string;
    name: string;
    size: number;
    type: string;
    file: File;
    sheetName?: string;
}

interface ErrorMessage {
    ErrName: string | null;
    ErrMessage: string | null;
    ErrStackRace: string | undefined;
    ErrCode?: string;
    inputValue: string | null;
}

interface TopicMapping {
    [key: string]: string;
}

export default function WordsAddPage() {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [fileContent, setFileContent] = useState<WordEntry[] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [editingWord, setEditingWord] = useState<WordEntry | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const [topicsCodeName, setTopicCodeName] = useState<Record<string, string>>({});
    const [proWordsCount, setProWordsCount] = useState<number>(0);
    const [chuckWordsBuN, setChuckWordsBuN] = useState<number>(0);
    const { data, error, isLoading } = useSWR("topics", fetcher);
    const [completeMessage, setCompleteMessage] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<{ task: string, progress: number } | null>(null);
    const user = useSelector((state: RootState) => state.user);
    const [loginNeedModalOpen, setLoginNeedModalOpen] = useState<boolean>(!user.uuid);

    // Format converter related states
    const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
    const [showTopicSelectModal, setShowTopicSelectModal] = useState<boolean>(false);
    const [currentMappingTopic, setCurrentMappingTopic] = useState<string>('');
    const [unmappedTopics, setUnmappedTopics] = useState<string[]>([]);
    const [topicMappings, setTopicMappings] = useState<TopicMapping>({});
    const [pendingConversion, setPendingConversion] = useState<WordEntry[] | null>(null);
    const [selectedTopicForMapping, setSelectedTopicForMapping] = useState<string>('');
    const [topicNameCode, setTopicNameCode] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!user.uuid) return;
        if (user.uuid) setLoginNeedModalOpen(false);
    }, [user])

    // 가상화 리스트 설정
    const virtualizer = useVirtualizer({
        count: fileContent?.length || 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 5,
    });

    useEffect(() => {
        if (data) {
            const topicsCode: Record<string, string> = {};
            const topicsName: Record<string, string> = {};
            for (const topic of data) {
                topicsCode[topic.code] = topic.name;
                topicsName[topic.name] = topic.code;
            }
            setTopicCodeName(topicsCode);
            setTopicNameCode(topicsName);
        }
    }, [data, error, isLoading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);

        if (selectedFiles.length === 0) return;

        const newFiles: FileInfo[] = [];
        const invalidFiles: string[] = [];

        selectedFiles.forEach((file, index) => {
            const isOkType = file.type === "text/plain" || file.type === "application/json" || file.type === "text/tab-separated-values" || file.name.endsWith('.xlsx')

            if (!isOkType) {
                invalidFiles.push(file.name);
                return;
            }

            // 중복 파일 체크
            const isDuplicate = files.some(existingFile =>
                existingFile.name === file.name && existingFile.size === file.size
            );

            if (!isDuplicate) {
                newFiles.push({
                    id: `file-${Date.now()}-${index}`,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file
                });
            }
        });

        if (invalidFiles.length > 0) {
            setErrorMessage(`Only .txt or .json or .tsv or .xlsx files are supported. Invalid files: ${invalidFiles.join(', ')}`);
        } else {
            setErrorMessage(null);
        }

        if (newFiles.length > 0) {
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleRemoveFile = (fileId: string) => {
        setFiles(prev => prev.filter(file => file.id !== fileId));
        setErrorMessage(null);
    };

    const handleSheetNameChange = (fileId: string, sheetName: string) => {
        setFiles(prev => prev.map(file =>
            file.id === fileId ? { ...file, sheetName } : file
        ));
    };

    const parseTxtFile = (content: string): WordEntry[] => {
        const lines = content.split('\n').filter(line => line.trim());
        const words: WordEntry[] = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            const delimiterIndex = trimmedLine.indexOf('/');
            if (delimiterIndex === -1){
                words.push({
                    id: `word-${Date.now()}-${index}`,
                    word: trimmedLine,
                    topics: []
                })
                return;
            }

            const word = trimmedLine.substring(0, delimiterIndex).trim();
            const topicsStr = trimmedLine.substring(delimiterIndex + 1).trim();

            if (word && topicsStr) {
                const topics = topicsStr.split(',').map(t => t.trim()).filter(t => t);
                words.push({
                    id: `word-${Date.now()}-${index}`,
                    word,
                    topics
                });
            }
        });

        return words;
    };

    const parseTsvFile = (content: string): WordEntry[] => {
        const lines = content.split('\n').filter(line => line.trim());
        const words: WordEntry[] = [];

        // 헤더 건너뛰기
        const dataLines = lines.slice(1);

        dataLines.forEach((line, index) => {
            const columns = line.split('\t');
            if (columns.length < 2) return;

            const word = columns[0]?.trim();
            const topicsStr = columns[1]?.trim();

            if (word && topicsStr) {
                const topics = topicsStr.split(',').map(t => t.trim()).filter(t => t);
                words.push({
                    id: `word-${Date.now()}-${index}`,
                    word,
                    topics
                });
            }
        });

        return words;
    };

    const paresXlsxFile = async (file: File, sheetName?: string) => {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        const getSheetName = () => {
            if (!sheetName) {
                if (workbook.SheetNames.length > 1) throw new Error('xlsx에 시트가 2개 이상이고 시트이름이 주어지지 않았습니다.');
                return workbook.SheetNames[0];
            } else {
                return sheetName;
            }
        }

        try {
            const realSheet = getSheetName();
            const worksheet = workbook.Sheets[realSheet];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | undefined)[][];

            const words: WordEntry[] = [];

            jsonData.slice(1).forEach((data, index) => {
                const word = data[0]?.trim();
                const topicsStr = data[1]?.trim()
                if (word && topicsStr) {
                    const topics = topicsStr.split(',').map(t => t.trim()).filter(t => t);
                    words.push({
                        id: `word-${Date.now()}-${index}`,
                        word,
                        topics
                    });
                }
            })
            return words;

        } catch (error) {
            throw error;
        }

    }

    const checkUnmappedTopics = (words: WordEntry[]): string[] => {
        const allTopics = new Set<string>();
        words.forEach(word => {
            word.topics.forEach(topic => allTopics.add(topic));
        });

        const allAvailableTopics: Record<string, string> = { ...topicNameCode, ...topicsCodeName };
        return Array.from(allTopics).filter(topic => !allAvailableTopics[topic]);
    };

    const processFile = (file: File, sheetName?: string): Promise<WordEntry[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target?.result as string;
                    let words: WordEntry[] = [];

                    if (file.type === "application/json") {
                        const parsedJson = JSON.parse(content);
                        if (
                            typeof parsedJson === "object" &&
                            !Array.isArray(parsedJson) &&
                            parsedJson !== null
                        ) {
                            words = Object.entries(parsedJson).map(
                                ([word, topics], index) => {
                                    const tc: string[] =
                                        Array.isArray(topics) && topics.every(t => typeof t === "string")
                                            ? topics
                                            : [];
                                    return {
                                        id: `${file.name}-${index}`,
                                        word: word.trim(),
                                        topics: tc,
                                    };
                                }
                            );
                        } else {
                            throw new Error("Invalid JSON format. Expected { [word: string]: string[] }");
                        }
                    } else if (file.type === "text/plain") {
                        words = parseTxtFile(content);
                    } else if (file.type === "text/tab-separated-values") {
                        words = parseTsvFile(content);
                    } else if (file.name.endsWith('.xlsx')) {
                        words = await paresXlsxFile(file, sheetName);
                    }

                    resolve(words);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error("파일 읽기 실패"));
            reader.readAsText(file);
        });
    };

    const handleConfirm = async () => {
        if (files.length === 0) {
            setErrorMessage("No files selected.");
            return;
        }

        try {
            const allWordEntries: WordEntry[] = [];

            for (const fileInfo of files) {
                const wordEntries = await processFile(fileInfo.file);
                allWordEntries.push(...wordEntries);
            }

            // 중복 단어 제거 (단어와 토픽이 모두 같은 경우)
            const uniqueEntries = allWordEntries.filter((entry, index, self) =>
                index === self.findIndex(e =>
                    e.word === entry.word &&
                    JSON.stringify(e.topics.sort()) === JSON.stringify(entry.topics.sort())
                )
            );

            // ID 재할당
            const processedEntries = uniqueEntries.map((entry, index) => ({
                ...entry,
                id: `word-${index}`
            }));

            // unmapped topics 체크
            const unmapped = checkUnmappedTopics(processedEntries);

            if (unmapped.length > 0) {
                setUnmappedTopics(unmapped);
                const initialMappings: TopicMapping = {};
                unmapped.forEach(topic => {
                    initialMappings[topic] = '';
                });
                setTopicMappings(initialMappings);
                setPendingConversion(processedEntries);
                setShowMappingModal(true);
                return;
            }

            // 토픽 코드로 변환
            const finalEntries = processedEntries.map(entry => ({
                ...entry,
                topics: entry.topics.map(topic => topicsCodeName[topic] ? topic : topicNameCode[topic]).filter(code => code)
            }));

            setFileContent(finalEntries);
            setErrorMessage(null);
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
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

            setErrorMessage("Failed to process files. Please check file formats.");
        }
    };

    const handleTopicSelect = (topicName: string): void => {
        setSelectedTopicForMapping(topicName);
    };

    const openTopicSelectModal = (mappingTopic: string): void => {
        setCurrentMappingTopic(mappingTopic);
        setSelectedTopicForMapping(topicMappings[mappingTopic] || '');
        setShowTopicSelectModal(true);
    };

    const saveTopicSelection = (): void => {
        setTopicMappings(prev => ({
            ...prev,
            [currentMappingTopic]: selectedTopicForMapping
        }));
        setShowTopicSelectModal(false);
        setCurrentMappingTopic('');
        setSelectedTopicForMapping('');
    };

    const handleMappingComplete = (): void => {
        if (!pendingConversion) return;

        // topicMappings에서 실제 매핑된 주제들로 새로운 매핑 생성
        const newMappings: Record<string, string> = { ...topicNameCode };

        Object.entries(topicMappings).forEach(([originalTopic, selectedTopicName]) => {
            if (selectedTopicName) {
                if (topicNameCode[selectedTopicName]) {
                    newMappings[originalTopic] = topicNameCode[selectedTopicName];
                }
            }
        });

        // 변환된 엔트리 생성
        const finalEntries = pendingConversion.map(entry => ({
            ...entry,
            topics: entry.topics.map(topic => {
                return newMappings[topic] || topicNameCode[topic];
            }).filter(code => code)
        }));

        setFileContent(finalEntries);
        setErrorMessage(null);
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";

        // 모달 닫기
        setShowMappingModal(false);
        setPendingConversion(null);
        setUnmappedTopics([]);
        setTopicMappings({});
    };

    const handleEditWord = (wordEntry: WordEntry) => {
        setEditingWord(wordEntry);
        setIsModalOpen(true);
    };

    const handleAddNewWord = () => {
        const newWord = {
            id: `word-${Date.now()}`,
            word: "",
            topics: [],
        };
        setEditingWord(newWord);
        setIsModalOpen(true);
    };

    const handleWordSave = async (word: string, topics: string[]) => {
        if (!editingWord) return;

        if (fileContent) {
            const existingIndex = fileContent.findIndex(entry => entry.id === editingWord.id);

            if (existingIndex >= 0) {
                // 기존 단어 수정
                const updatedContent = [...fileContent];
                updatedContent[existingIndex] = { ...editingWord, word, topics };
                setFileContent(updatedContent);
            } else {
                // 새 단어 추가
                const newEntry = { ...editingWord, word, topics };
                setFileContent([...fileContent, newEntry]);

                // 가상화 리스트 맨 아래로 스크롤
                setTimeout(() => {
                    if (parentRef.current) {
                        parentRef.current.scrollTop = parentRef.current.scrollHeight;
                    }
                }, 100);
            }
        }

        setIsModalOpen(false);
        setEditingWord(null);
    };

    const handleDeleteWord = (id: string) => {
        if (fileContent) {
            const updatedContent = fileContent.filter(entry => entry.id !== id);
            setFileContent(updatedContent);
        }
    };

    const makeError = (error: PostgrestError) => {
        seterrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.stack,
            ErrCode: error.code,
            inputValue: '단어 대량 추가'
        });
        setProgressMessage(null);
    }

    const handleSave = async () => {
        if (!fileContent || fileContent.length === 0) {
            return setErrorMessage("저장할 단어가 없습니다.");
        }
        if (!user.uuid) return setErrorMessage("로그인 하지 않은 유저입니다.")
        setIsSaving(true);
        setProWordsCount(0);
        setProgressMessage({ task: "작업 준비중...", progress: 1 });
        console.log(fileContent);

        const addWaitWordThemeQuery: { wait_word_id: number, theme_id: number }[] = [];
        const wordWaitThemeQuery: { word_id: number; theme_id: number; typez: 'add'; req_by: string | null; }[] = [];

        const { data: themeData, error: themeError } = await SCM.get().allThemes()
        if (themeError) return makeError(themeError);
        const codeToId: { [key: string]: number } = {};
        themeData.forEach(({ code, id }) => {
            codeToId[code] = id;
        })

        setProgressMessage({ task: "기존 추가요청과 중복되는지 살펴보는 중...", progress: 15 });
        const { data: waitWords, error: waitWordsError } = await SCM.get().allWaitWords("add");
        if (waitWordsError) return makeError(waitWordsError);
        const duplicateAddReqIds: number[] = [];
        const duplicateAddReqMap: { [key: number]: string[] } = {}
        fileContent.forEach(({ word, topics }) => {
            for (const data of waitWords) {
                if (data.word === word) {
                    duplicateAddReqIds.push(data.id);
                    duplicateAddReqMap[data.id] = topics;
                }
            }
        })
        const existAddReqWordThemes: { [key: number]: string[] } = {};
        for (const chuck of chunkArray(duplicateAddReqIds, 300)) {
            const { data: addReqWordThemes, error: addReqWordThemesError } = await SCM.get().waitWordsThemes(chuck);
            if (addReqWordThemesError) return makeError(addReqWordThemesError);
            addReqWordThemes.forEach(({ wait_word_id, themes: { code } }) => {
                existAddReqWordThemes[wait_word_id] = [...(existAddReqWordThemes[wait_word_id] ?? []), code];
            })
        }

        duplicateAddReqIds.forEach((waitWordId) => {
            const rt = duplicateAddReqMap[waitWordId] ?? []
            const rat = new Set(existAddReqWordThemes[waitWordId] ?? [])

            const difference = [...new Set(rt.filter(x => !rat.has(x)))];
            if (difference.length > 0) {
                difference.forEach((code) => {
                    addWaitWordThemeQuery.push({ wait_word_id: waitWordId, theme_id: codeToId[code] })
                })
            }
        })
        setProgressMessage({ task: "기존 요청을 업데이트 하는중...", progress: 20 });
        const { error: addReqWordThemesInsertError } = await SCM.add().waitWordThemes(addWaitWordThemeQuery);
        if (addReqWordThemesInsertError) return makeError(addReqWordThemesInsertError);

        setProgressMessage({ task: "이미 존재하는 단어인지 확인하는 중...", progress: 23 });
        const exitsWords: { word: string, id: number }[] = []
        const exitsWordMap: { [key: string]: number } = {}
        for (const chuck of chunkArray(fileContent, 300)) {
            const { data: exitsWordsData, error: exitsWordsError } = await SCM.get().wordsByWords(chuck.map(({ word }) => word));
            if (exitsWordsError) return makeError(exitsWordsError);
            exitsWords.push(...exitsWordsData)
            exitsWordsData.forEach(({ word, id }) => {
                exitsWordMap[word] = id;
            })
        }

        const wordThemesMap: { [key: string]: string[] } = {};
        for (const chuck of chunkArray(exitsWords, 300)) {
            const { data: exitsWordThemesData, error: exitsWordThemesError } = await SCM.get().wordsThemes(chuck.map(({ id }) => id));
            if (exitsWordThemesError) return makeError(exitsWordThemesError);
            exitsWordThemesData.forEach(({ words: { word }, themes: { code } }) => {
                wordThemesMap[word] = [...(wordThemesMap[word] || []), code];
            })
        }

        for (const { word, topics } of fileContent) {
            const wordId = exitsWordMap[word]
            if (!wordId) continue;
            const exitsTheme = new Set(wordThemesMap[word] ?? []);
            const topicSet = topics ?? [];

            const difference = [...new Set(topicSet.filter(x => !exitsTheme.has(x)))];
            if (difference.length > 0) {
                difference.forEach((code) => {
                    wordWaitThemeQuery.push({ word_id: wordId, req_by: user.uuid ?? null, typez: "add", theme_id: codeToId[code] })
                })
            }
        }
        setProgressMessage({ task: "기존 단어에 대해서 주제 추가요청을 하는 중...", progress: 33 });
        const { error: wordWaitThemeInsertError } = await SCM.add().wordThemesReq(wordWaitThemeQuery);
        if (wordWaitThemeInsertError) return makeError(wordWaitThemeInsertError);

        const kWord1 = new Set(exitsWords.map(({ word }) => word));
        const kWord2 = new Set(waitWords.map(({ word }) => word));

        const remainWord = fileContent.filter(({ word }) => !kWord1.has(word) && !kWord2.has(word));
        const remainWordChunk = chunkArray(remainWord, 300);
        setChuckWordsBuN(remainWordChunk.length);
        for (const chuck of remainWordChunk) {
            const waitWordsQuery: { word: string, requested_by: string | null, request_type: "add" }[] = [];
            const waitWordsThemesQuery: { wait_word_id: number; theme_id: number; }[] = [];
            const waitWordThemeMap: { [key: string]: string[] } = {};
            chuck.forEach(({ word, topics }) => {
                waitWordsQuery.push({ word, request_type: "add", requested_by: user.uuid ?? null });
                waitWordThemeMap[word] = topics;
            })
            const { data: waitWordData, error: waitWordError } = await SCM.add().waitWords(waitWordsQuery);
            if (waitWordError) return makeError(waitWordError);
            waitWordData.forEach(({ word, id }) => {
                const themes = waitWordThemeMap[word]
                themes.forEach((code) => {
                    waitWordsThemesQuery.push({ wait_word_id: id, theme_id: codeToId[code] })
                })
            })
            setProgressMessage({ task: `추가요청 처리중... ${proWordsCount} / ${chuckWordsBuN}`, progress: 50 + Math.floor(proWordsCount / chuckWordsBuN * 50) });
            const { error: waitWordsThemesError } = await SCM.add().waitWordThemes(waitWordsThemesQuery);
            if (waitWordsThemesError) return makeError(waitWordsThemesError);
            setProWordsCount(prev => prev + 1);
        }

        setCompleteMessage(`단어 추가 요청이 성공적으로 완료되었습니다. 총 ${remainWord.length ? remainWord.length + "개의 단어가 추가 요청" + (wordWaitThemeQuery.length ? "," : "") : ""} ${wordWaitThemeQuery.length ? wordWaitThemeQuery.length + "개의 단어의 주제 추가요청이 되었습니다." : ""} (이미 추가요청에 대한 업데이트요청은 집계되지 않습니다.)`);
        setFileContent(null);
        setProgressMessage(null);
        setIsSaving(false);
    };

    const isValid = (entry: WordEntry) => {
        let p = false;
        const regex1 = /[0-9ㄱ-ㅎ]+/;
        for (const c of entry.word) {
            if (!regex1.test(disassemble(c)[0])) {
                p = true;
                break;
            }
        }
        const regex = /^[0-9ㄱ-힣]*$/;
        return !regex.test(entry.word) || p;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (name: string) => {
        if (name.endsWith('.xlsx')) {
            return <FileSpreadsheet size={16} className="text-green-500 dark:text-green-400 flex-shrink-0" />;
        }
        return <FileText size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />;
    };


    const getAllAvailableTopics = (): string[] => {
        return Object.keys(topicNameCode).sort();
    };

    if (isLoading) {
        return <div className="min-h-screen"><Spinner /></div>
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white dark:bg-gray-900 transition-colors min-h-screen">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">단어 대량 추가요청</h1>
                <HelpModal
                    title="단어 대량 추가 도움말"
                    triggerText="도움말"
                    triggerClassName="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                    <div className="space-y-6">
                        {/* 파일 업로드 섹션 */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">📁 파일 업로드</h3>
                            <p className="mb-3 text-gray-700 dark:text-gray-300">
                                다음 형식의 파일을 업로드할 수 있습니다. 여러 파일을 동시에 선택할 수 있어요.
                            </p>

                            <div className="space-y-4">
                                {/* TXT 파일 */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📄 TXT 파일</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        형식: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">단어 / 주제들(,로 구분)</code>
                                    </p>
                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border text-sm font-mono">
                                        <div>사과 / 과일,음식</div>
                                        <div>컴퓨터 / 전자기기,기술</div>
                                        <div>축구 / 스포츠,운동</div>
                                    </div>
                                </div>

                                {/* JSON 파일 */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📋 JSON 파일</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        형식: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{"{"}&quot;단어&quot;: [&quot;주제1&quot;, &quot;주제2&quot;]{"}"}</code>
                                    </p>
                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border text-sm font-mono">
                                        <div>{"{"}</div>
                                        <div>&nbsp;&nbsp;&quot;사과&quot;: [&quot;과일&quot;, &quot;음식&quot;],</div>
                                        <div>&nbsp;&nbsp;&quot;컴퓨터&quot;: [&quot;전자기기&quot;, &quot;기술&quot;],</div>
                                        <div>&nbsp;&nbsp;&quot;축구&quot;: [&quot;스포츠&quot;, &quot;운동&quot;]</div>
                                        <div>{"}"}</div>
                                    </div>
                                </div>

                                {/* TSV 파일 */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📊 TSV 파일</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        헤더 필수: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">단어\t주제</code>
                                    </p>
                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border text-sm font-mono">
                                        <div>단어&nbsp;&nbsp;&nbsp;&nbsp;주제</div>
                                        <div>사과&nbsp;&nbsp;&nbsp;&nbsp;과일,음식</div>
                                        <div>컴퓨터&nbsp;&nbsp;전자기기,기술</div>
                                        <div>축구&nbsp;&nbsp;&nbsp;&nbsp;스포츠,운동</div>
                                    </div>
                                </div>

                                {/* XLSX 파일 */}
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📈 XLSX 파일</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        엑셀 파일, 헤더 필수
                                    </p>
                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left p-1 font-medium">단어</th>
                                                    <th className="text-left p-1 font-medium">주제</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="p-1">사과</td>
                                                    <td className="p-1">과일,음식</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-1">컴퓨터</td>
                                                    <td className="p-1">전자기기,기술</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-1">축구</td>
                                                    <td className="p-1">스포츠,운동</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 주제 매핑 섹션 */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">🎯 주제 매핑</h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                                파일에서 인식되지 않는 주제가 발견되면 자동으로 매핑 모달이 표시됩니다.
                            </p>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                                <li>• 정확한 시스템 주제와 매핑해주세요</li>
                                <li>• 모든 주제가 매핑되어야 다음 단계로 진행됩니다</li>
                                <li>• 매핑된 주제는 해당 단어에 자동으로 적용됩니다</li>
                            </ul>
                        </div>

                        {/* 내용 확인 및 편집 섹션 */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">✏️ 내용 확인 및 편집</h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                                파일 처리 후 단어 목록을 확인하고 편집할 수 있습니다.
                            </p>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                                <li>• <strong>편집</strong>: 연필 아이콘을 클릭하여 단어와 주제를 수정</li>
                                <li>• <strong>삭제</strong>: X 아이콘을 클릭하여 단어를 제거</li>
                                <li>• <strong>추가</strong>: &quot;새 단어 추가&quot; 버튼으로 단어를 추가</li>
                                <li>• 빨간색으로 표시된 단어는 오류가 있는 단어입니다</li>
                            </ul>
                        </div>

                        {/* 단어 추가 요청 섹션 */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">🚀 모든 단어 추가 요청</h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                                모든 단어가 올바르게 입력되었는지 확인한 후 &quot;모든 단어 추가 요청&quot; 버튼을 클릭하세요.
                            </p>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                                <li>• 오류가 있는 단어가 있으면 버튼이 비활성화됩니다</li>
                                <li>• 처리 진행상황을 실시간으로 확인할 수 있습니다</li>
                                <li>• 완료 후 결과를 확인할 수 있습니다</li>
                            </ul>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                💡 <strong>팁</strong>: 파일 형식을 정확히 지키면 더 정확한 처리가 가능합니다.
                                문제가 발생하면 파일 형식을 다시 확인해보세요.
                            </p>
                        </div>
                    </div>
                </HelpModal>
            </div>

            {/* 파일 입력 */}
            <div className="space-y-4">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.tsv,.xlsx"
                    multiple
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />

                {/* 선택된 파일 목록 */}
                {files.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            선택된 파일 ({files.length})
                        </h3>
                        <div className="grid gap-2 max-h-40 overflow-y-auto">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {getFileIcon(file.name)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatFileSize(file.size)}
                                            </p>
                                        </div>
                                        {file.name.endsWith('.xlsx') && (
                                            <input
                                                type="text"
                                                value={file.sheetName || ''}
                                                onChange={(e) => handleSheetNameChange(file.id, e.target.value)}
                                                placeholder="시트 이름"
                                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            />
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFile(file.id)}
                                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                        title="파일 제거"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 확인 버튼 */}
            <button
                onClick={handleConfirm}
                disabled={files.length === 0}
                className={`px-4 py-2 rounded focus:outline-none focus:ring-2 transition-colors ${files.length === 0
                        ? "bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                        : "bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 focus:ring-blue-300 dark:focus:ring-blue-400"
                    }`}
            >
                파일 처리 ({files.length})
            </button>

            {/* 에러 메시지 */}
            {errorMessage && (
                <p className="text-red-500 dark:text-red-400 text-sm">{errorMessage}</p>
            )}

            {/* 파일 내용 리스트 */}
            {fileContent && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            단어 목록 ({fileContent.length} 개)
                        </h2>
                        <button
                            onClick={handleAddNewWord}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded hover:bg-purple-600 dark:hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-400 transition-colors"
                        >
                            <Plus size={16} />
                            새 단어 추가
                        </button>
                    </div>

                    {/* 저장 버튼 */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || fileContent.some((entry) => isValid(entry))}
                        className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 ${isSaving || fileContent.some((entry) => isValid(entry))
                                ? "bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                                : "bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 focus:ring-green-300 dark:focus:ring-green-400"
                            }`}
                    >
                        <Save size={20} />
                        {isSaving ? `저장 중... ${proWordsCount} / ${chuckWordsBuN}` : "모든 단어 추가 요청"}
                    </button>

                    {/* 가상화 리스트 */}
                    <div
                        ref={parentRef}
                        className="h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                                const entry = fileContent[virtualItem.index];
                                return (
                                    <div
                                        key={virtualItem.key}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualItem.size}px`,
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                    >
                                        <div
                                            className={`flex items-center justify-between p-3 mx-2 my-1 border rounded-lg transition-colors ${isValid(entry)
                                                    ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                                                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                                                }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-medium ${isValid(entry)
                                                            ? "text-red-700 dark:text-red-300"
                                                            : "text-gray-900 dark:text-gray-100"
                                                        }`}>
                                                        {entry.word || "(빈 단어)"}
                                                    </span>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {entry.topics.map((topic) => (
                                                            <span
                                                                key={topic}
                                                                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                                                            >
                                                                {topicsCodeName[topic] || topic}
                                                            </span>
                                                        ))}
                                                        {entry.topics.length === 0 && (
                                                            <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                                                주제 없음
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEditWord(entry)}
                                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                    title="단어 편집"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWord(entry.id)}
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    title="단어 삭제"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 주제 매핑 모달 */}
            {showMappingModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                주제 매핑 설정
                            </h3>
                            <button
                                onClick={() => setShowMappingModal(false)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <Alert className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                파일에서 인식되지 않는 주제들이 발견되었습니다. 각 주제를 시스템의 기존 주제와 매핑해주세요.
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                            {unmappedTopics.map((topic) => (
                                <div key={topic} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                    <div className="flex-1">
                                        <span className="font-medium text-gray-800 dark:text-gray-100">
                                            {topic}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <button
                                            onClick={() => openTopicSelectModal(topic)}
                                            className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {topicMappings[topic] || "주제 선택..."}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowMappingModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleMappingComplete}
                                disabled={unmappedTopics.some(topic => !topicMappings[topic])}
                                className={`px-4 py-2 rounded transition-colors ${unmappedTopics.some(topic => !topicMappings[topic])
                                        ? "bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                                        : "bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700"
                                    }`}
                            >
                                매핑 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 주제 선택 모달 */}
            {showTopicSelectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                주제 선택: {currentMappingTopic}
                            </h3>
                            <button
                                onClick={() => setShowTopicSelectModal(false)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {getAllAvailableTopics().map((topicName) => (
                                <button
                                    key={topicName}
                                    onClick={() => handleTopicSelect(topicName)}
                                    className={`w-full p-3 text-left rounded border transition-colors ${selectedTopicForMapping === topicName
                                            ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{topicName}</span>
                                        {selectedTopicForMapping === topicName && (
                                            <Check size={16} className="text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowTopicSelectModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={saveTopicSelection}
                                disabled={!selectedTopicForMapping}
                                className={`px-4 py-2 rounded transition-colors ${!selectedTopicForMapping
                                        ? "bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                                        : "bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700"
                                    }`}
                            >
                                선택 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 단어 편집 모달 */}
            {isModalOpen && editingWord && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                {editingWord.word ? "단어 편집" : "새 단어 추가"}
                            </h3>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditingWord(null);
                                }}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <WordAddForm
                            saveFn={handleWordSave}
                            initWord={editingWord.word}
                            initThemes={editingWord.topics}
                        />
                    </div>
                </div>
            )}

            {/* 에러 모달 */}
            {errorModalView && (
                <ErrorModal
                    error={errorModalView}
                    onClose={() => seterrorModalView(null)}
                />
            )}

            {/* 완료 메시지 모달 */}
            {completeMessage && (
                <CompleteModal
                    open={completeMessage !== null}
                    title={"단어 추가 완료"}
                    description={completeMessage}
                    onClose={() => setCompleteMessage(null)}
                />
            )}

            {/* 처리중 모달 */}
            {progressMessage && (
                <ProgressModal
                    isModalOpen={progressMessage !== null}
                    isProcessing={isSaving}
                    onClose={() => setProgressMessage(null)}
                    progress={progressMessage.progress}
                    currentTask={progressMessage.task}
                />
            )}
            {!user.uuid && loginNeedModalOpen && (
                <LoginRequiredModal open={loginNeedModalOpen} onClose={() => setLoginNeedModalOpen(false)} />
            )}
        </div>
    );
}