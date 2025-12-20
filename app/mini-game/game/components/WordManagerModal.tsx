"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getAllWords, searchWordsByPrefix, updateWord, deleteWord, addWord } from '../lib/wordDB';
import gameManager from '../lib/GameManager';
import ConfirmModal from './ConfirmModal';

interface WordManagerModalProps {
    onClose: () => void;
}

/**
 * 단어 관리 모달 컴포넌트
 * ㄱㄴㄷ순 정렬, 접두사 검색, 수정, 삭제 기능 제공
 */
const WordManagerModal = ({ onClose }: WordManagerModalProps) => {
    const [words, setWords] = useState<Array<{ word: string; theme: string }>>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newWord, setNewWord] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [addError, setAddError] = useState('');
    const [editError, setEditError] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
    const parentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        loadWords();
    }, []);

    const loadWords = async () => {
        setIsLoading(true);
        const allWords = await getAllWords();
        setWords(allWords);
        setIsLoading(false);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadWords();
            return;
        }

        const results = await searchWordsByPrefix(searchQuery.trim());
        setWords(results);
    };

    const handleEdit = (word: string) => {
        setEditingWord(word);
        setEditValue(word);
    };

    const handleSaveEdit = async (oldWord: string) => {
        const trimmed = editValue.trim();
        const pattern = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;
        const sanitized = trimmed.replace(pattern, '');
        if (!trimmed || sanitized.length <= 1) {
            setEditError('유효한 단어를 입력하세요. (특수문자 제거 후 길이 2 이상)');
            return;
        }
        setEditError('');
        if (sanitized && sanitized !== oldWord) {
            try {
                await updateWord(oldWord, sanitized);
                gameManager.editWordInDB(oldWord, sanitized);
                await loadWords();
            } catch (error) {
                setEditError('단어 수정 중 오류가 발생했습니다.');
            }
        }
        setEditingWord(null);
        setEditValue('');
    };

    const handleCancelEdit = () => {
        setEditingWord(null);
        setEditValue('');
    };

    const handleDelete = (word: string) => {
        setConfirmTarget(word);
        setConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        const word = confirmTarget;
        setConfirmOpen(false);
        setConfirmTarget(null);
        if (!word) return;
        try {
            await deleteWord(word);
            gameManager.deleteWordFromDB(word);
            await loadWords();
        } catch (e) {
            // ignore
        }
    };

    const handleAddWord = async () => {
        const trimmed = newWord.trim();
        const pattern = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;
        const sanitized = trimmed.replace(pattern, '');
        if (!trimmed || sanitized.length <= 1) {
            setAddError('유효한 단어를 입력하세요. (특수문자 제거 후 길이 2 이상)');
            return;
        }
        setAddError('');
        try {
            await addWord(sanitized);
            gameManager.addWordToDB(sanitized, ['자유']);
            setNewWord('');
            await loadWords();
        } catch (error) {
            setAddError('단어 추가 중 오류가 발생했습니다.');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const rowHeight = 56;
    const virtualizer = useVirtualizer({
        count: words.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 5,
    });

    return (
        <div
            className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-49"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl w-[90%] max-w-[800px] max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">
                        단어 목록 관리
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* 검색 및 추가 섹션 */}
                <div className="p-6 border-b space-y-4">
                    {/* 검색 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            단어 검색 (접두사)
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="예: 끝말, 게임..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* 새 단어 추가 */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                            placeholder="새 단어 추가..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                            onClick={handleAddWord}
                            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
                        >
                            추가
                        </button>
                    </div>
                    {addError && (
                        <div className="text-sm text-red-500 mt-2">{addError}</div>
                    )}
                </div>

                {/* 단어 목록 */}
                <div ref={parentRef} className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="text-center text-gray-500 py-8">
                            로딩 중...
                        </div>
                    ) : words.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            {searchQuery ? '검색 결과가 없습니다.' : '등록된 단어가 없습니다.'}
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-gray-600 mb-4">
                                총 {words.length}개의 단어
                            </div>
                            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                                {virtualizer.getVirtualItems().map((virtualRow) => {
                                    const item = words[virtualRow.index];
                                    return (
                                        <div
                                            key={item.word}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            {editingWord === item.word ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(item.word);
                                                            if (e.key === 'Escape') handleCancelEdit();
                                                        }}
                                                        className="flex-1 px-3 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2 ml-3">
                                                        <button
                                                            onClick={() => handleSaveEdit(item.word)}
                                                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                    {editError && (
                                                        <div className="text-sm text-red-500 mt-2">{editError}</div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex-1">
                                                        <span className="text-gray-800 font-medium">
                                                            {item.word}
                                                        </span>
                                                        <span className="ml-3 text-sm text-gray-500">
                                                            ({item.theme})
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEdit(item.word)}
                                                            className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.word)}
                                                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* 푸터 */}
                <div className="p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                        닫기
                    </button>
                </div>
            </div>
            {confirmOpen && (
                <ConfirmModal
                    message={`"${confirmTarget}"를 삭제하시겠습니까?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
                />
            )}
        </div>
    );
};

export default WordManagerModal;