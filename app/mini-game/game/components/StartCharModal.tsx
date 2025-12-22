"use client";
import React from 'react';

type Props = {
    value: string;
    open: boolean;
    onClose: () => void;
    onChange: (v: string) => void;
    onSave: () => void;
};

const StartCharModal = ({ value, open, onClose, onChange, onSave }: Props) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/30 dark:bg-black/30">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[520px] p-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">제시어 시작글자 설정</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">원하는 시작 글자들을 공백 없이 나열해 입력하세요. 예: 한글 시작글자 `&apos;가나다&apos;` 또는 영문 시작글자 `&apos;abc&apos;`</p>
                <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full p-2 border rounded-md mb-3 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600" placeholder="예: 가나다" />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:text-gray-100">취소</button>
                    <button onClick={onSave} className="px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white">저장</button>
                </div>
            </div>
        </div>
    );
};

export default StartCharModal;