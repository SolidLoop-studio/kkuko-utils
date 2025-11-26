import { useState } from 'react';
import { SCM } from '@/app/lib/supabaseClient';
import { advancedQueryType } from '@/app/types/type';
import { GameMode, SearchResult } from '../types';

export const useWordSearch = () => {
    const [mode, setMode] = useState<GameMode>('kor-start');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);

    // 검색 파라미터
    const [startLetter, setStartLetter] = useState('');
    const [endLetter, setEndLetter] = useState('');
    const [mission, setMission] = useState('');
    const [minLength, setMinLength] = useState<number>(2);
    const [maxLength, setMaxLength] = useState<number>(100);
    const [sortBy, setSortBy] = useState<'abc' | 'length' | 'attack'>('length');
    const [duem, setDuem] = useState(true);
    const [miniInfo, setMiniInfo] = useState(false);
    const [manner, setManner] = useState<''|'man' | 'jen' | 'eti'>('man');
    const [ingjung, setIngjung] = useState(true);
    const [simpleQuery, setSimpleQuery] = useState('');
    const [displayLimit, setDisplayLimit] = useState<string>('100');
    const [selectedTheme, setSelectedTheme] = useState<{id: number, name: string} | null>(null);

    const handleSearch = async () => {
        setLoading(true);
        setSearchPerformed(true);
        setResults([]);
        
        try {
            let query: advancedQueryType;
            
            if (mode === 'kor-start' || mode === 'kor-end') {
                if (mode === 'kor-start' && startLetter.trim() === '') return;
                if (mode === 'kor-end' && endLetter.trim() === '') return;
                query = {
                    mode,
                    start: startLetter?.trim() || undefined,
                    end: endLetter?.trim() || undefined,
                    mission,
                    ingjung,
                    man: manner === 'man',
                    jen: manner === 'jen',
                    eti: manner === 'eti',
                    duem,
                    miniInfo,
                    length_min: minLength,
                    length_max: maxLength,
                    sort_by: sortBy,
                    limit: displayLimit === '' || isNaN(Number(displayLimit)) ? 100 : Number(displayLimit)
                };
            } else if (mode === 'kung') {
                if (startLetter.trim() === '') return;
                query = {
                    mode: 'kung',
                    start: startLetter?.trim().slice(0,3) || undefined,
                    end: endLetter?.trim().slice(0,3) || undefined,
                    mission,
                    ingjung,
                    man: manner === 'man',
                    jen: manner === 'jen',
                    eti: manner === 'eti',
                    duem,
                    miniInfo,
                    length_min: 3,
                    length_max: 3,
                    sort_by: sortBy,
                    limit: displayLimit === '' || isNaN(Number(displayLimit)) ? 100 : Number(displayLimit)
                };
            } else if (mode === 'hunmin') {
                if (simpleQuery.trim() === '' || simpleQuery.trim().length !== 2) return;
                query = {
                    mode: 'hunmin',
                    query: simpleQuery.trim(),
                    mission,
                    limit: displayLimit === '' || isNaN(Number(displayLimit)) ? 100 : Number(displayLimit)
                };
            } else {
                if (!selectedTheme) return;
                query = {
                    mode: 'jaqi',
                    query: simpleQuery.trim(),
                    theme: selectedTheme.id,
                    limit: displayLimit === '' || isNaN(Number(displayLimit)) ? 100 : Number(displayLimit)
                };
            }

            const { data, error } = await SCM.get().wordsByAdvancedQuery(query);
            if (error) {
                console.error('검색 오류:', error);
                return;
            }
            setResults(data);
        } catch (error) {
            console.error('검색 중 오류 발생:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        mode, setMode,
        results, setResults,
        loading, setLoading,
        searchPerformed, setSearchPerformed,
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
        selectedTheme, setSelectedTheme,
        handleSearch
    };
};
