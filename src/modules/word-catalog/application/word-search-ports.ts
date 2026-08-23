import type { Result } from '../../../shared/application/result';
import type {
    AdvancedWordSearchQuery,
    WordSearchResult,
    WordThemeSummary,
} from './word-search-types';

export interface WordCatalogQueryGateway {
    suggestWords(query: string): Promise<Result<string[]>>;
    searchAdvanced(query: AdvancedWordSearchQuery): Promise<Result<WordSearchResult[]>>;
    listThemes(): Promise<Result<WordThemeSummary[]>>;
}
