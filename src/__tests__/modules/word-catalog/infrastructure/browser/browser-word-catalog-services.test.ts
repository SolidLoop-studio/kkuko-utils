jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SearchWordsService } from '../../../../../modules/word-catalog/application/search-words';
import { GetWordDetailService } from '../../../../../modules/word-catalog/application/get-word-detail';
import { GetWordDownloadService } from '../../../../../modules/word-catalog/application/get-word-download';
import { GetWordStatisticsService } from '../../../../../modules/word-catalog/application/get-word-statistics';
import { GetWordCombinerCandidatesService } from '../../../../../modules/word-catalog/application/get-word-combiner-candidates';
import { createBrowserWordCatalogServices } from '../../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services';

describe('browser word catalog services', () => {
    it('creates fresh word catalog services wired to the browser Supabase client', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { from: jest.Mock; rpc: jest.Mock } };
        const wordsResponse = Promise.resolve({ data: [{ word: '가나', noin_canuse: false, k_canuse: true }], error: null });
        const waitWordsResponse = Promise.resolve({ data: [{ word: '가나다', request_type: 'add' }], error: null });
        const firstLetterStatisticsResponse = Promise.resolve({
            data: [{
                first_letter: '가',
                exact_k_count: 11,
                exact_n_count: 7,
                exact_k_count_updated_at: '2026-08-24T00:00:00Z',
                exact_n_count_updated_at: null,
                exact_len3_k_count: 5,
                exact_len3_n_count: 3,
                exact_len3_k_count_updated_at: null,
                exact_len3_n_count_updated_at: null,
            }],
            error: null,
        });
        const lastLetterStatisticsResponse = Promise.resolve({ data: [], error: null });
        browserSupabaseClient.from.mockImplementation((table: string) => {
            const response = table === 'words'
                ? wordsResponse
                : table === 'wait_words'
                    ? waitWordsResponse
                    : table === 'word_first_letter_counts'
                        ? firstLetterStatisticsResponse
                        : lastLetterStatisticsResponse;
            const query = {
                ilike: jest.fn(() => response),
                eq: jest.fn(),
                then: response.then.bind(response),
            };
            query.eq.mockReturnValue(query);
            return { select: jest.fn(() => query) };
        });

        const first = createBrowserWordCatalogServices();
        const second = createBrowserWordCatalogServices();

        expect(first.searchWordsService).toBeInstanceOf(SearchWordsService);
        expect(second.searchWordsService).toBeInstanceOf(SearchWordsService);
        expect(first.searchWordsService).not.toBe(second.searchWordsService);
        expect(first.wordDetailService).toBeInstanceOf(GetWordDetailService);
        expect(second.wordDetailService).toBeInstanceOf(GetWordDetailService);
        expect(first.wordDetailService).not.toBe(second.wordDetailService);
        expect(first.wordDownloadService).toBeInstanceOf(GetWordDownloadService);
        expect(second.wordDownloadService).toBeInstanceOf(GetWordDownloadService);
        expect(first.wordDownloadService).not.toBe(second.wordDownloadService);
        expect(first.wordStatisticsService).toBeInstanceOf(GetWordStatisticsService);
        expect(second.wordStatisticsService).toBeInstanceOf(GetWordStatisticsService);
        expect(first.wordStatisticsService).not.toBe(second.wordStatisticsService);
        expect(first.wordCombinerCandidateService).toBeInstanceOf(GetWordCombinerCandidatesService);
        expect(second.wordCombinerCandidateService).toBeInstanceOf(GetWordCombinerCandidatesService);
        expect(first.wordCombinerCandidateService).not.toBe(second.wordCombinerCandidateService);
        await expect(first.searchWordsService.suggest(' 가 ')).resolves.toEqual({
            ok: true,
            value: ['가나', '가나다'],
        });
        await expect(first.wordDownloadService.get({
            includeAdded: true,
            includeDeleted: false,
            includeAcknowledged: true,
            includeNotAcknowledged: true,
            onlyWordChain: false,
        })).resolves.toEqual(expect.objectContaining({ ok: true }));
        await expect(first.wordStatisticsService.get()).resolves.toEqual({
            ok: true,
            value: {
                firstLetter: [{
                    letter: '가',
                    acknowledgedCount: 11,
                    notAcknowledgedCount: 7,
                    acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
                    notAcknowledgedUpdatedAt: null,
                }],
                lastLetter: [],
                threeLetter: [{
                    letter: '가',
                    acknowledgedCount: 5,
                    notAcknowledgedCount: 3,
                    acknowledgedUpdatedAt: null,
                    notAcknowledgedUpdatedAt: null,
                }],
            },
        });
    });
});
