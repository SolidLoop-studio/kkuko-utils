import { Database } from '@/app/types/database.types';

export type GameMode = 'kor-start' | 'kor-end' | 'kung' | 'hunmin' | 'jaqi';
export type Theme = Database['public']['Tables']['themes']['Row'];

export interface SearchResult {
    word: string;
    nextWordCount: number;
}

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
    selectedTheme: { id: number; name: string } | null;
}
