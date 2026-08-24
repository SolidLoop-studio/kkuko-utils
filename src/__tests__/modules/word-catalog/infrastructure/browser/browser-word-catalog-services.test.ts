jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SearchWordsService } from '../../../../../modules/word-catalog/application/search-words';
import { GetWordDetailService } from '../../../../../modules/word-catalog/application/get-word-detail';
import { GetWordDownloadService } from '../../../../../modules/word-catalog/application/get-word-download';
import { createBrowserWordCatalogServices } from '../../../../../modules/word-catalog/infrastructure/browser/browser-word-catalog-services';

describe('browser word catalog services', () => {
    it('creates fresh word catalog services wired to the browser Supabase client', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { from: jest.Mock; rpc: jest.Mock } };
        const wordsResponse = Promise.resolve({ data: [{ word: '가나', noin_canuse: false, k_canuse: true }], error: null });
        const waitWordsResponse = Promise.resolve({ data: [{ word: '가나다', request_type: 'add' }], error: null });
        browserSupabaseClient.from.mockImplementation((table: string) => {
            const response = table === 'words' ? wordsResponse : waitWordsResponse;
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
    });
});
