"use client";
import React, { useState } from 'react';
import ErrorModal from '../components/ErrModal';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import { useReleaseNotes } from '@/src/modules/release-notes';

type ReleaseTab = 'internal' | 'github';

const ReleaseNote = () => {
    const { internal, github } = useReleaseNotes();
    const [activeTab, setActiveTab] = useState<ReleaseTab>('internal');
    const [expandedNote, setExpandedNote] = useState<string | null>(null);
    const [isInternalErrorDismissed, setIsInternalErrorDismissed] = useState(false);
    const notes = internal.data ?? [];
    const githubNotes = github.data ?? [];
    const loading = internal.isPending || github.isPending;

    const toggleExpand = (id: string) => {
        if (expandedNote === id) {
            setExpandedNote(null);
        } else {
            setExpandedNote(id);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            time: date.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        };
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-lg">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white text-black dark:bg-gray-900 dark:text-white min-h-screen p-4 md:p-8">
            <header className="mb-8">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">릴리즈 노트</h1>
                    <div className="h-1 w-24 bg-blue-500 rounded"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-300">
                        끄코 유틸의 업데이트 및 새로운 기능에 대한 정보입니다.
                    </p>
                </div>
            </header>

            <main className="max-w-5xl mx-auto">
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`px-4 py-2 text-sm md:text-base font-semibold rounded-t-lg transition-colors ${activeTab === 'internal'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            onClick={() => {
                                setActiveTab('internal');
                                setExpandedNote(null);
                            }}
                        >
                            내부 릴리즈 노트
                        </button>
                        <button
                            type="button"
                            className={`px-4 py-2 text-sm md:text-base font-semibold rounded-t-lg transition-colors ${activeTab === 'github'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            onClick={() => {
                                setActiveTab('github');
                                setExpandedNote(null);
                            }}
                        >
                            GitHub Releases
                        </button>
                    </div>
                </div>

                {activeTab === 'internal' && (notes.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-lg">릴리즈 노트가 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {notes.map((note) => {
                            const { date, time } = formatDate(note.createdAt);
                            const noteKey = `internal-${note.id}`;
                            const isExpanded = expandedNote === noteKey;
                            
                            return (
                                <div 
                                    key={note.id}
                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
                                >
                                    <div 
                                        className="p-4 md:p-6 cursor-pointer flex justify-between items-center"
                                        onClick={() => toggleExpand(noteKey)}
                                    >
                                        <div className="flex-1">
                                            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                                                {note.title}
                                            </h2>
                                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center">
                                                    <Calendar size={16} className="mr-1" />
                                                    <span>{date}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Clock size={16} className="mr-1" />
                                                    <span>{time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight 
                                            size={20} 
                                            className={`text-blue-500 transform transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-4 md:p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
                                            <div className="prose dark:prose-invert max-w-none mt-2 whitespace-pre-wrap">
                                                {note.content}
                                            </div>
                                            {note.link && (
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <a 
                                                        href={note.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                                                    >
                                                        <span className="font-medium">관련 링크:</span>
                                                        <span className="ml-2">{note.link}</span>
                                                        <ChevronRight size={16} className="ml-1" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}

                {activeTab === 'github' && (
                    github.error ? (
                        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-lg text-red-600 dark:text-red-400">{github.error.message}</p>
                        </div>
                    ) : githubNotes.length === 0 ? (
                        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-lg">GitHub 릴리즈가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {githubNotes.map((note) => {
                                const { date, time } = formatDate(note.publishedAt);
                                const noteKey = `github-${note.id}`;
                                const isExpanded = expandedNote === noteKey;

                                return (
                                    <div
                                        key={note.id}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
                                    >
                                        <div
                                            className="p-4 md:p-6 cursor-pointer flex justify-between items-center"
                                            onClick={() => toggleExpand(noteKey)}
                                        >
                                            <div className="flex-1">
                                                <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                                                    {note.name || note.tagName}
                                                </h2>
                                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center">
                                                        <Calendar size={16} className="mr-1" />
                                                        <span>{date}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Clock size={16} className="mr-1" />
                                                        <span>{time}</span>
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                        {note.tagName}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight
                                                size={20}
                                                className={`text-blue-500 transform transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                        </div>

                                        {isExpanded && (
                                            <div className="p-4 md:p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
                                                <div className="prose dark:prose-invert max-w-none mt-2 whitespace-pre-wrap">
                                                    <MarkdownViewer content={note.body || '릴리즈 설명이 없습니다.'} />
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <a
                                                        href={note.htmlUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                                                    >
                                                        <span className="font-medium">GitHub에서 보기</span>
                                                        <ChevronRight size={16} className="ml-1" />
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
                {internal.error && !isInternalErrorDismissed && (
                    <ErrorModal
                        error={{
                            ErrName: '릴리즈 노트 오류',
                            ErrMessage: internal.error.message,
                            ErrStackRace: '',
                            inputValue: '릴리즈 노트',
                        }}
                        onClose={() => setIsInternalErrorDismissed(true)}
                    />
                )}
            </main>
        </div>
    );
};

export default ReleaseNote;
