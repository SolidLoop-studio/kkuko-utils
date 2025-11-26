import { Settings } from 'lucide-react';
import WordSearchHelpModal from './WordSearchHelpModal';
import { GameMode } from '../types';
import { getModeLabel } from '../utils';

interface SearchHeaderProps {
    mode: GameMode;
    onOpenModeModal: () => void;
}

export default function SearchHeader({ mode, onOpenModeModal }: SearchHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    <span className="text-blue-600">단어</span> 고급 검색
                </h1>
                <WordSearchHelpModal />
            </div>
            <button
                onClick={onOpenModeModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
                <Settings className="h-5 w-5" />
                {getModeLabel(mode)}
            </button>
        </div>
    );
}
