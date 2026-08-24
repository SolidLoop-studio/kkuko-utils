export type WordSearchMode = 'kor-start' | 'kor-end' | 'kung' | 'hunmin' | 'jaqi';

export type WordSearchSortOrder = 'abc' | 'length' | 'attack';

interface KoreanWordSearchOptions {
    start?: string;
    end?: string;
    mission: string;
    isAcceptedOnly: boolean;
    isManner: boolean;
    isJen: boolean;
    isEtiquette: boolean;
    hasMiniInfo: boolean;
    limit: number;
    sortOrder: WordSearchSortOrder;
}

interface KoreanChainSearchOptions extends KoreanWordSearchOptions {
    isDuemApplied: boolean;
    minimumLength: number;
    maximumLength: number;
}

export type AdvancedWordSearchQuery =
    | (KoreanChainSearchOptions & { mode: 'kor-start' })
    | (KoreanChainSearchOptions & { mode: 'kor-end' })
    | (KoreanWordSearchOptions & { mode: 'kung' })
    | {
        mode: 'hunmin';
        query: string;
        mission: string;
        limit: number;
    }
    | {
        mode: 'jaqi';
        query: string;
        themeId: number;
        limit: number;
    };

export type WordSearchRequest =
    | { type: 'simple'; query: string }
    | { type: 'advanced'; query: AdvancedWordSearchQuery };

export interface WordSearchResult {
    word: string;
    nextWordCount: number;
}

export interface WordThemeSummary {
    id: number;
    code: string;
    name: string;
}
