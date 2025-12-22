import { Settings } from 'lucide-react';
import WordSearchHelpModal from './WordSearchHelpModal';
import { GameMode } from '../types';
import { getModeLabel, getModeShortLabel } from '../utils';

interface SearchHeaderProps {
    searchType: 'simple' | 'advanced';
    setSearchType: (type: 'simple' | 'advanced') => void;
    mode: GameMode;
    onOpenModeModal: () => void;
}

export default function SearchHeader({ searchType, setSearchType, mode, onOpenModeModal }: SearchHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    <span className="text-blue-600">단어</span> 검색
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSearchType('simple')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            searchType === 'simple'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        일반
                    </button>
                    <button
                        onClick={() => setSearchType('advanced')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            searchType === 'advanced'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        고급
                    </button>
                </div>
                <WordSearchHelpModal />
            </div>
            {searchType === 'advanced' && (
                <button
                    onClick={onOpenModeModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    <Settings className="h-5 w-5" />
                    {getModeShortLabel(mode)}
                </button>
            )}
        </div>
    );
}
