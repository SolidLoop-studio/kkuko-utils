jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { ModerateDocsRequestsService } from '@/src/modules/docs/application/moderate-docs-requests';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';

describe('browser docs services', () => {
    it('creates a fresh docs request moderation service wired to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as {
            browserSupabaseClient: { rpc: jest.Mock };
        };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: { processedRequestIds: [11], processedRequestCount: 1 },
            error: null,
        });

        const first = createBrowserDocsServices();
        const second = createBrowserDocsServices();

        expect(first.docsRequestModerationService).toBeInstanceOf(ModerateDocsRequestsService);
        expect(second.docsRequestModerationService).toBeInstanceOf(ModerateDocsRequestsService);
        expect(first.docsRequestModerationService).not.toBe(second.docsRequestModerationService);
        await expect(first.docsRequestModerationService.approve({
            selections: [{ requestId: 11, duem: true }],
        })).resolves.toEqual({
            ok: true,
            value: { processedRequestIds: [11], processedRequestCount: 1 },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('approve_docs_requests', {
            p_selections: [{ requestId: 11, duem: true }],
        });
    });
});
