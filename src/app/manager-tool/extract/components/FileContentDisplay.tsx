"use client";
import React, { useState, useRef, useMemo, useCallback } from "react";
import { Upload, FileText, List, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { ScrollArea } from "@/src/app/components/ui/scroll-area";
import { Badge } from "@/src/app/components/ui/badge";
import { Button } from "@/src/app/components/ui/button";

export interface FileContentDisplayProps {
    setFileContent: React.Dispatch<React.SetStateAction<string | null>>;
    setFile: React.Dispatch<React.SetStateAction<File | null>>
    file: File | null;
    fileContent: string | null;
    onFileUpload?: (content: string) => void;
    onError?: (error: unknown) => void;
    className?: string;
    resultData?: string[];
    resultTitle?: string;
}

// 가상화된 텍스트 뷰어 컴포넌트
const VirtualizedTextViewer = React.memo(({ 
    content, 
    placeholder = "내용이 없습니다.",
    searchable = false 
}: { 
    content: string; 
    placeholder?: string;
    searchable?: boolean;
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 });
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // 검색 기능이 있을 때 필터링된 라인들
    const filteredLines = useMemo(() => {
        if (!content) return [];
        const lines = content.split('\n');
        
        if (!searchTerm.trim()) return lines;
        
        const searchLower = searchTerm.toLowerCase();
        return lines.filter(line => 
            line.toLowerCase().includes(searchLower)
        );
    }, [content, searchTerm]);

    // 현재 보여줄 라인들 (가상화)
    const visibleLines = useMemo(() => {
        return filteredLines.slice(visibleRange.start, visibleRange.end);
    }, [filteredLines, visibleRange]);

    // 스크롤 핸들러 - 가상화 범위 업데이트
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        const target = event.target as HTMLDivElement;
        const scrollTop = target.scrollTop;
        const itemHeight = 20; // 대략적인 라인 높이
        const containerHeight = target.clientHeight;
        
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / itemHeight) + 50, // 버퍼 추가
            filteredLines.length
        );
        
        setVisibleRange({ start: Math.max(0, startIndex - 25), end: endIndex });
    }, [filteredLines.length]);

    // 대용량 텍스트인지 확인 (5천 줄 이상)
    const isLargeContent = filteredLines.length > 5000;

    if (!content) {
        return (
            <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground dark:text-muted-foreground">
                {placeholder}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {searchable && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                    <Input
                        placeholder="내용 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm bg-background border-input dark:border-input text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground dark:bg-gray-800 dark:border-gray-700"
                    />
                    {searchTerm && (
                        <Badge variant="secondary" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs bg-secondary dark:bg-secondary text-secondary-foreground dark:text-secondary-foreground">
                            {filteredLines.length}줄
                        </Badge>
                    )}
                </div>
            )}
            
            <ScrollArea 
                className="h-[250px] sm:h-[300px] lg:h-[400px] w-full border rounded-md border-border bg-background dark:bg-gray-800 dark:border-gray-700"
                onScrollCapture={isLargeContent ? handleScroll : undefined}
                ref={scrollAreaRef}
            >
                <div className="p-3 sm:p-4">
                    {isLargeContent ? (
                        // 대용량 텍스트 - 가상화 적용
                        <div 
                            style={{ 
                                height: `${filteredLines.length * 20}px`,
                                position: 'relative'
                            }}
                        >
                            <div 
                                style={{
                                    position: 'absolute',
                                    top: `${visibleRange.start * 20}px`,
                                    width: '100%'
                                }}
                            >
                                <pre className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-5 text-foreground dark:text-foreground font-mono">
                                    {visibleLines.join('\n')}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        // 일반 크기 텍스트 - 전체 렌더링
                        <pre className="text-xs sm:text-sm whitespace-pre-wrap break-words text-foreground dark:text-foreground font-mono">
                            {filteredLines.join('\n')}
                        </pre>
                    )}
                </div>
            </ScrollArea>
            
            {isLargeContent && (
                <div className="text-xs text-muted-foreground dark:text-muted-foreground text-center">
                    대용량 파일 - 가상화 모드 ({filteredLines.length.toLocaleString()}줄)
                </div>
            )}
        </div>
    );
});

VirtualizedTextViewer.displayName = 'VirtualizedTextViewer';

const FileContentDisplay = ({
    setFileContent,
    setFile,
    file,
    fileContent,
    onFileUpload,
    onError,
    className = "",
    resultData = [],
    resultTitle = "처리 결과"
}: FileContentDisplayProps) => {
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 파일업로드 처리
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    const cleanContent = content.replace(/\r/g, "").replace(/\s+$/, "").replaceAll("\u200b", "");
                    setFileContent(cleanContent);
                    onFileUpload?.(cleanContent);
                } catch (err) {
                    onError?.(err);
                } finally {
                    setLoading(false);
                }
            };

            reader.onerror = (event) => {
                const error = event.target?.error;
                onError?.(error);
                setLoading(false);
            };

            setLoading(true);
            reader.readAsText(selectedFile);
        }
    }, [setFile, setFileContent, onFileUpload, onError]);

    // 모두 삭제
    const resetAll = useCallback(() => {
        setFile(null);
        setFileContent(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [setFile, setFileContent]);

    // 결과 데이터를 문자열로 변환 (메모화)
    const resultContent = useMemo(() => {
        return resultData.length > 0 ? resultData.join('\n') : '';
    }, [resultData]);

    return (
        <div className={`space-y-4 sm:space-y-6 ${className}`}>
            {/* File Upload Section */}
            <Card className="bg-card dark:bg-gray-800 dark:border-gray-700 border-border">
                <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-card-foreground dark:text-card-foreground">
                        <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                        파일 업로드
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="file-upload" className="text-sm text-foreground dark:text-foreground ">텍스트 파일 선택</Label>
                        <Input
                            id="file-upload"
                            ref={fileInputRef}
                            type="file"
                            accept=".txt"
                            onChange={handleFileUpload}
                            disabled={loading}
                            className="text-sm bg-background dark:bg-background border-input dark:border-input text-foreground dark:text-foreground file:bg-muted dark:file:bg-muted file:text-muted-foreground dark:file:text-muted-foreground file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:text-sm file:font-medium hover:file:bg-muted/80 dark:hover:file:bg-muted/80 dark:bg-gray-800 dark:border-gray-700"
                        />
                    </div>

                    {file && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-muted dark:bg-gray-600 dark:border-gray-500 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground dark:text-muted-foreground" />
                                <span className="text-sm font-medium truncate text-foreground dark:text-foreground">{file.name}</span>
                                <Badge variant="secondary" className="text-xs flex-shrink-0 bg-secondary dark:bg-secondary text-secondary-foreground dark:text-secondary-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                </Badge>
                            </div>
                            <Button variant="outline" size="sm" onClick={resetAll} className="w-full sm:w-auto border-border dark:border-border bg-background dark:bg-background text-foreground dark:text-foreground hover:bg-accent dark:hover:bg-accent hover:text-accent-foreground dark:hover:text-accent-foreground">
                                초기화
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Content Display Section */}
            <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                {/* File Content */}
                <Card className="w-full bg-card border-border dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader className="pb-3 sm:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-card-foreground dark:text-card-foreground">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                            업로드된 파일 내용
                            {fileContent && (
                                <Badge variant="outline" className="text-xs flex-shrink-0 ml-auto border-border dark:border-border text-foreground dark:text-foreground">
                                    {fileContent.split('\n').length.toLocaleString()}줄
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-[250px] sm:h-[300px] lg:h-[400px]">
                                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary dark:border-primary"></div>
                            </div>
                        ) : (
                            <VirtualizedTextViewer
                                content={fileContent || ''}
                                placeholder="아직 파일이 업로드되지 않았습니다."
                                searchable={true}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Results Display */}
                <Card className="w-full bg-card border-border dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader className="pb-3 sm:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-card-foreground dark:text-card-foreground">
                            <List className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="truncate">{resultTitle}</span>
                            {resultData.length > 0 && (
                                <Badge variant="default" className="text-xs flex-shrink-0 ml-auto bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground">
                                    {resultData.length}개
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                        <VirtualizedTextViewer
                            content={resultContent}
                            placeholder="아직 처리 결과가 없습니다."
                            searchable={resultData.length > 100}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default FileContentDisplay;