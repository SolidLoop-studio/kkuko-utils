jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn(), rpc: jest.fn() },
}));

import { SearchWordsService } from '@/src/modules/word-catalog/application/search-words';
import { createBrowserWordCatalogServices } from '@/src/modules/word-catalog/infrastructure/browser/browser-word-catalog-services';

describe('browser word catalog services', () => {
    it('creates fresh word-search services wired to the browser Supabase client', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { from: jest.Mock; rpc: jest.Mock } };
        const wordsResponse = Promise.resolve({ data: [{ word: '가나' }], error: null });
        const waitWordsResponse = Promise.resolve({ data: [{ word: '가나다' }], error: null });
        browserSupabaseClient.from.mockImplementation((table: string) => {
            const response = table === 'words' ? wordsResponse : waitWordsResponse;
            const query = {
                ilike: jest.fn(() => response),
                then: response.then.bind(response),
            };
            return { select: jest.fn(() => query) };
        });

        const first = createBrowserWordCatalogServices();
        const second = createBrowserWordCatalogServices();

        expect(first.searchWordsService).toBeInstanceOf(SearchWordsService);
        expect(second.searchWordsService).toBeInstanceOf(SearchWordsService);
        expect(first.searchWordsService).not.toBe(second.searchWordsService);
        await expect(first.searchWordsService.suggest(' 가 ')).resolves.toEqual({
            ok: true,
            value: ['가나', '가나다'],
        });
    });
});
