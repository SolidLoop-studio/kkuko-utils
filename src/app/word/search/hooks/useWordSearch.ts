import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
    useWordCatalogSearch,
    type AdvancedWordSearchQuery,
    type WordCatalogSearchService,
    type WordSearchMode,
    type WordSearchRequest,
    type WordThemeSummary,
} from '@/src/modules/word-catalog';

type SearchType = 'simple' | 'advanced';
type Manner = '' | 'man' | 'jen' | 'eti';

const parseDisplayLimit = (displayLimit: string): number => (
    displayLimit === '' || Number.isNaN(Number(displayLimit))
        ? 100
        : Number(displayLimit)
);

const createKoreanSearchQuery = ({
    mode,
    startLetter,
    endLetter,
    mission,
    ingjung,
    manner,
    duem,
    minLength,
    maxLength,
    sortBy,
    limit,
}: {
    mode: 'kor-start' | 'kor-end';
    startLetter: string;
    endLetter: string;
    mission: string;
    ingjung: boolean;
    manner: Manner;
    duem: boolean;
    minLength: number;
    maxLength: number;
    sortBy: 'abc' | 'length' | 'attack';
    limit: number;
}): AdvancedWordSearchQuery => ({
    mode,
    start: startLetter.trim() || undefined,
    end: endLetter.trim() || undefined,
    mission: mission.trim(),
    isAcceptedOnly: ingjung,
    isManner: manner === 'man',
    isJen: manner === 'jen',
    isEtiquette: manner === 'eti',
    isDuemApplied: duem,
    minimumLength: minLength,
    maximumLength: maxLength,
    sortOrder: sortBy,
    limit,
});

/** 단어 검색 폼 상태를 제출 기반 word-catalog 조회 요청으로 변환한다. */
export const useWordSearch = (service?: WordCatalogSearchService) => {
    const searchParams = useSearchParams();
    const [searchTypeState, setSearchTypeState] = useState<SearchType>('simple');
    const [modeState, setModeState] = useState<WordSearchMode>('kor-start');
    const [committedRequest, setCommittedRequest] = useState<WordSearchRequest | null>(null);

    const [startLetter, setStartLetter] = useState('');
    const [endLetter, setEndLetter] = useState('');
    const [mission, setMission] = useState('');
    const [minLength, setMinLength] = useState(2);
    const [maxLength, setMaxLength] = useState(100);
    const [sortBy, setSortBy] = useState<'abc' | 'length' | 'attack'>('length');
    const [duem, setDuem] = useState(true);
    const [miniInfo, setMiniInfo] = useState(false);
    const [manner, setManner] = useState<Manner>('man');
    const [ingjung, setIngjung] = useState(true);
    const [simpleQuery, setSimpleQuery] = useState('');
    const [displayLimit, setDisplayLimit] = useState('100');
    const [selectedTheme, setSelectedTheme] = useState<WordThemeSummary | null>(null);

    const searchQuery = useWordCatalogSearch(committedRequest, service);
    const clearSearch = useCallback(() => setCommittedRequest(null), []);

    const setSearchType = useCallback((nextSearchType: SearchType) => {
        setSearchTypeState(nextSearchType);
        setCommittedRequest(null);
    }, []);

    const setMode = useCallback((nextMode: WordSearchMode) => {
        setModeState(nextMode);
        setCommittedRequest(null);
    }, []);

    const handleSimpleSearch = useCallback(() => {
        setCommittedRequest({ type: 'simple', query: simpleQuery.trim() });
    }, [simpleQuery]);

    const handleSearch = useCallback(() => {
        const limit = parseDisplayLimit(displayLimit);
        let query: AdvancedWordSearchQuery;

        if (modeState === 'kor-start' || modeState === 'kor-end') {
            query = createKoreanSearchQuery({
                mode: modeState,
                startLetter,
                endLetter,
                mission,
                ingjung,
                manner,
                duem,
                minLength,
                maxLength,
                sortBy,
                limit,
            });
        } else if (modeState === 'kung') {
            query = {
                mode: 'kung',
                start: startLetter.trim().slice(0, 3) || undefined,
                end: endLetter.trim().slice(0, 3) || undefined,
                mission: mission.trim(),
                isAcceptedOnly: ingjung,
                isManner: manner === 'man',
                isJen: manner === 'jen',
                isEtiquette: manner === 'eti',
                sortOrder: sortBy,
                limit,
            };
        } else if (modeState === 'hunmin') {
            query = {
                mode: 'hunmin',
                query: simpleQuery.trim(),
                mission: mission.trim(),
                limit,
            };
        } else {
            query = {
                mode: 'jaqi',
                query: simpleQuery.trim(),
                themeId: selectedTheme?.id ?? 0,
                limit,
            };
        }

        setCommittedRequest({ type: 'advanced', query });
    }, [
        displayLimit,
        duem,
        endLetter,
        ingjung,
        manner,
        maxLength,
        minLength,
        mission,
        modeState,
        selectedTheme,
        simpleQuery,
        sortBy,
        startLetter,
    ]);

    useEffect(() => {
        const modeParam = searchParams.get('mode');
        const queryParam = searchParams.get('q');
        if (!modeParam && !queryParam) {
            return;
        }

        const targetMode: WordSearchMode = modeParam === 'l'
            ? 'kor-end'
            : modeParam === 'k'
                ? 'kung'
                : 'kor-start';
        setModeState(targetMode);
        setSearchTypeState('advanced');

        if (!queryParam) {
            setCommittedRequest(null);
            return;
        }

        const normalizedQuery = queryParam.trim();
        setManner('');
        if (targetMode === 'kor-end') {
            setEndLetter(normalizedQuery);
        } else {
            setStartLetter(normalizedQuery);
        }
        if (targetMode === 'kung') {
            setMinLength(3);
            setMaxLength(3);
        }

        const query: AdvancedWordSearchQuery = targetMode === 'kung'
            ? {
                mode: 'kung',
                start: normalizedQuery.slice(0, 3) || undefined,
                end: undefined,
                mission: '',
                isAcceptedOnly: true,
                isManner: false,
                isJen: false,
                isEtiquette: false,
                sortOrder: 'length',
                limit: 100,
            }
            : createKoreanSearchQuery({
                mode: targetMode,
                startLetter: targetMode === 'kor-start' ? normalizedQuery : '',
                endLetter: targetMode === 'kor-end' ? normalizedQuery : '',
                mission: '',
                ingjung: true,
                manner: '',
                duem: true,
                minLength: 2,
                maxLength: 100,
                sortBy: 'length',
                limit: 100,
            });
        setCommittedRequest({ type: 'advanced', query });
    }, [searchParams]);

    return {
        searchType: searchTypeState,
        setSearchType,
        mode: modeState,
        setMode,
        committedRequest,
        results: searchQuery.data ?? [],
        loading: searchQuery.isFetching,
        error: searchQuery.error ?? null,
        searchPerformed: committedRequest !== null,
        clearSearch,
        startLetter,
        setStartLetter,
        endLetter,
        setEndLetter,
        mission,
        setMission,
        minLength,
        setMinLength,
        maxLength,
        setMaxLength,
        sortBy,
        setSortBy,
        duem,
        setDuem,
        miniInfo,
        setMiniInfo,
        manner,
        setManner,
        ingjung,
        setIngjung,
        simpleQuery,
        setSimpleQuery,
        displayLimit,
        setDisplayLimit,
        selectedTheme,
        setSelectedTheme,
        handleSearch,
        handleSimpleSearch,
    };
};
