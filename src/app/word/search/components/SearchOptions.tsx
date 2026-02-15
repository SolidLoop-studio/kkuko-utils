import { Search, Loader2, Tag } from 'lucide-react';
import { GameMode } from '../types';

interface SearchOptionsProps {
    mode: GameMode;
    startLetter: string;
    setStartLetter: (v: string) => void;
    endLetter: string;
    setEndLetter: (v: string) => void;
    mission: string;
    setMission: (v: string) => void;
    minLength: number;
    setMinLength: (v: number) => void;
    maxLength: number;
    setMaxLength: (v: number) => void;
    sortBy: 'abc' | 'length' | 'attack';
    setSortBy: (v: 'abc' | 'length' | 'attack') => void;
    duem: boolean;
    setDuem: (v: boolean) => void;
    miniInfo: boolean;
    setMiniInfo: (v: boolean) => void;
    manner: '' | 'man' | 'jen' | 'eti';
    setManner: (v: '' | 'man' | 'jen' | 'eti') => void;
    ingjung: boolean;
    setIngjung: (v: boolean) => void;
    simpleQuery: string;
    setSimpleQuery: (v: string) => void;
    displayLimit: string;
    setDisplayLimit: (v: string) => void;
    loading: boolean;
    handleSearch: () => void;
    onOpenThemeModal: () => void;
    selectedTheme: { id: number; name: string } | null;
}

export default function SearchOptions({
    mode,
    startLetter, setStartLetter,
    endLetter, setEndLetter,
    mission, setMission,
    minLength, setMinLength,
    maxLength, setMaxLength,
    sortBy, setSortBy,
    duem, setDuem,
    miniInfo, setMiniInfo,
    manner, setManner,
    ingjung, setIngjung,
    simpleQuery, setSimpleQuery,
    displayLimit, setDisplayLimit,
    loading,
    handleSearch,
    onOpenThemeModal,
    selectedTheme
}: SearchOptionsProps) {

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getSelectedThemeName = () => {
        if (!selectedTheme) return '주제 미선택';
        return selectedTheme.name;
    };

    if (mode === 'kor-start' || mode === 'kor-end' || mode === 'kung') {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    <input
                        type="text"
                        value={startLetter}
                        onChange={(e) => setStartLetter(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="시작 글자"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="text"
                        value={endLetter}
                        onChange={(e) => setEndLetter(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="끝 글자"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="text"
                        value={mission}
                        onChange={(e) => setMission(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="미션 글자"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">최소 글자수:</label>
                        <input
                            type="number"
                            value={minLength}
                            onChange={(e) => setMinLength(parseInt(e.target.value) || 2)}
                            disabled={mode === 'kung'}
                            min={2}
                            max={10}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">최대 글자수:</label>
                        <input
                            type="number"
                            value={maxLength}
                            onChange={(e) => setMaxLength(parseInt(e.target.value) || 10)}
                            disabled={mode === 'kung'}
                            min={2}
                            max={10}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">표시 개수:</label>
                        <input
                            value={displayLimit}
                            onChange={(e) => setDisplayLimit(e.target.value)}
                            min={-1}
                            placeholder="-1: 제한없음"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'abc' | 'length' | 'attack')}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="abc">가나다순</option>
                        {mode !== 'kung' && <option value="length">길이순</option>}
                        <option value="attack">공격단어순</option>
                    </select>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={duem}
                            onChange={(e) => setDuem(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">두음법칙</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={miniInfo}
                            onChange={(e) => setMiniInfo(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">간단 정보</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={ingjung}
                            onChange={(e) => setIngjung(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">어인정</span>
                    </label>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="manner"
                                value=""
                                checked={manner === ''}
                                onChange={(e) => setManner(e.target.value as '' | 'man' | 'jen' | 'eti')}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">없음</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="manner"
                                value="man"
                                checked={manner === 'man'}
                                onChange={(e) => setManner(e.target.value as 'man' | 'jen' | 'eti')}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">매너</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="manner"
                                value="jen"
                                checked={manner === 'jen'}
                                onChange={(e) => setManner(e.target.value as 'man' | 'jen' | 'eti')}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">젠틀</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="manner"
                                value="eti"
                                checked={manner === 'eti'}
                                onChange={(e) => setManner(e.target.value as 'man' | 'jen' | 'eti')}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">에티켓</span>
                        </label>
                    </div>
                </div>

                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    검색
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={simpleQuery}
                    onChange={(e) => setSimpleQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={mode === 'hunmin' ? '검색할 단어 입력' : '자음 입력'}
                    maxLength={mode === 'hunmin' ? 2 : undefined}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    검색
                </button>
            </div>
            {mode === 'hunmin' && (
                <input
                    type="text"
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="미션 글자"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            )}
            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={miniInfo}
                        onChange={(e) => setMiniInfo(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">간단 정보</span>
                </label>
                {mode === 'jaqi' && (
                    <>
                        <button
                            onClick={onOpenThemeModal}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            <Tag className="h-4 w-4" />
                            <span className="text-sm">주제 선택</span>
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            선택된 주제: <span className="font-medium text-purple-600 dark:text-purple-400">{getSelectedThemeName()}</span>
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
