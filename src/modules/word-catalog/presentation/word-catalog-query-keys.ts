import type { WordSearchRequest } from '../application/word-search-types';
import type { WordDownloadFilter } from '../application/word-download-types';

export const wordCatalogQueryKeys = {
    all: ['word-catalog'] as const,
    search: (request: WordSearchRequest) => (
        [...wordCatalogQueryKeys.all, 'search', request] as const
    ),
    suggestions: (query: string) => (
        [...wordCatalogQueryKeys.all, 'suggestions', query] as const
    ),
    detail: (word: string) => (
        [...wordCatalogQueryKeys.all, 'detail', word] as const
    ),
    wordDownload: (filter: WordDownloadFilter) => [
        ...wordCatalogQueryKeys.all,
        'download',
        filter,
    ] as const,
    themes: () => [...wordCatalogQueryKeys.all, 'themes'] as const,
};
