"use client";
import React from 'react';

interface Props {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModal = ({ message, onConfirm, onCancel }: Props) => {
    return (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 dark:bg-black/40 flex items-center justify-center z-60" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
                <div className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-100">확인</div>
                <div className="mb-6 text-sm text-gray-700 dark:text-gray-200">{message}</div>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-200">취소</button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-500 dark:bg-red-600 text-white">확인</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;