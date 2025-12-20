"use client";
import React, { useState } from 'react';
import gameManager from '../lib/GameManager';

interface Props {
    onClose: () => void;
}

const DictionaryModal = ({ onClose }: Props) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<string | null>(null);

    const pattern = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;

    const doSearch = () => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResult(null);
            return;
        }
        const sanitized = trimmed.replace(pattern, '').toLowerCase();
        const themes = gameManager.getWordTheme(sanitized);
        if (themes && themes.length > 0) {
            setResult(`주제: ${themes.join(', ')}`);
        } else {
            setResult('없는 단어입니다');
        }
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-[640px] p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">사전 검색</h3>
                    <button onClick={onClose} className="text-gray-500">×</button>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                            placeholder="단어를 입력하세요"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded"
                        />
                        <button onClick={doSearch} className="bg-green-500 text-white px-4 py-2 rounded">검색</button>
                    </div>

                    <div className="min-h-[56px] p-3 border rounded bg-gray-50 text-gray-800">
                        {result === null ? (
                            <div className="text-sm text-gray-500">단어를 입력하고 검색하세요.</div>
                        ) : (
                            <div className="text-sm">{result}</div>
                        )}
                    </div>

                    <div className="flex">
                        <button onClick={onClose} className="ml-auto bg-gray-300 text-gray-800 py-2 px-4 rounded">닫기</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DictionaryModal;