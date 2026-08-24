jest.mock('../../../../../shared/infrastructure/supabase/server-client', () => ({
    createServerSupabaseClient: jest.fn(),
}));

import { SearchWordsService } from '../../../../../modules/word-catalog/application/search-words';
import { createServerWordCatalogServices } from '../../../../../modules/word-catalog/infrastructure/server/server-word-catalog-services';

const mockCreateServerSupabaseClient = jest.requireMock(
    '../../../../../shared/infrastructure/supabase/server-client',
) as { createServerSupabaseClient: jest.Mock };

describe('server word catalog services', () => {
    it('creates a search service using the request-scoped server Supabase client', async () => {
        const response = Promise.resolve({ data: [{ word: '가나다' }], error: null });
        const client = {
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    ilike: jest.fn(() => response),
                    then: response.then.bind(response),
                })),
            })),
            rpc: jest.fn(),
        };
        mockCreateServerSupabaseClient.createServerSupabaseClient.mockResolvedValue(client);

        const services = await createServerWordCatalogServices();

        expect(services.searchWordsService).toBeInstanceOf(SearchWordsService);
        await expect(services.searchWordsService.suggest('가')).resolves.toEqual({
            ok: true,
            value: ['가나다'],
        });
        expect(mockCreateServerSupabaseClient.createServerSupabaseClient).toHaveBeenCalledTimes(1);
        expect(client.from).toHaveBeenCalledWith('words');
    });
});
