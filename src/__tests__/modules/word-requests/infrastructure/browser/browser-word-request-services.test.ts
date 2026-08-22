jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { ManageUserWordRequestsService } from '@/src/modules/word-requests/application/manage-user-word-requests';
import { createBrowserWordRequestServices } from '@/src/modules/word-requests/infrastructure/browser/browser-word-request-services';

describe('browser word request services', () => {
    it('creates fresh user word request services wired to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as {
            browserSupabaseClient: { rpc: jest.Mock };
        };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: { requestId: 11, word: '나비', requestType: 'delete' },
            error: null,
        });

        const first = createBrowserWordRequestServices();
        const second = createBrowserWordRequestServices();

        expect(first.userWordRequestService).toBeInstanceOf(ManageUserWordRequestsService);
        expect(second.userWordRequestService).toBeInstanceOf(ManageUserWordRequestsService);
        expect(first.userWordRequestService).not.toBe(second.userWordRequestService);
        await expect(first.userWordRequestService.requestDeletion({ word: ' 나비 ' })).resolves.toEqual({
            ok: true,
            value: { requestId: 11, word: '나비', requestType: 'delete' },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('request_word_deletion', {
            p_word: '나비',
        });
    });
});
