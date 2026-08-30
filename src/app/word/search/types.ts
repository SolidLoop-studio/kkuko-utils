import type { WordSearchMode, WordThemeSummary } from '@/src/modules/word-catalog';

export type GameMode = WordSearchMode;

export interface SearchState {
    mode: GameMode;
    startLetter: string;
    endLetter: string;
    mission: string;
    minLength: number;
    maxLength: number;
    sortBy: 'abc' | 'length' | 'attack';
    duem: boolean;
    miniInfo: boolean;
    manner: '' | 'man' | 'jen' | 'eti';
    ingjung: boolean;
    simpleQuery: string;
    displayLimit: string;
    selectedTheme: WordThemeSummary | null;
}
