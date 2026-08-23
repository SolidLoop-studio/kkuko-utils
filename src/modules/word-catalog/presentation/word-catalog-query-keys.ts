import type { WordSearchRequest } from '../application/word-search-types';

export const wordCatalogQueryKeys = {
    all: ['word-catalog'] as const,
    search: (request: WordSearchRequest) => (
        [...wordCatalogQueryKeys.all, 'search', request] as const
    ),
    suggestions: (query: string) => (
        [...wordCatalogQueryKeys.all, 'suggestions', query] as const
    ),
    themes: () => [...wordCatalogQueryKeys.all, 'themes'] as const,
};
