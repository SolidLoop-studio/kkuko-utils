import { X } from 'lucide-react';
import { GameMode } from '../types';
import { getModeLabel } from '../utils';

interface ModeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentMode: GameMode;
    onSelectMode: (mode: GameMode) => void;
}

export default function ModeSelectionModal({
    isOpen,
    onClose,
    currentMode,
    onSelectMode
}: ModeSelectionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">검색 모드 선택</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>
                <div className="space-y-2">
                    {(['kor-start', 'kor-end', 'kung', 'hunmin', 'jaqi'] as GameMode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => onSelectMode(m)}
                            className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${
                                currentMode === m
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {getModeLabel(m)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
