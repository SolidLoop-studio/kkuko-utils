jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

jest.mock(
    '../../../../../modules/docs/infrastructure/browser/supabase-docs-list-query-gateway',
    () => ({
        SupabaseDocsListQueryGateway: jest.fn().mockImplementation(() => ({
            loadAll: jest.fn().mockResolvedValue({ ok: true, value: [] }),
        })),
    }),
);

jest.mock(
    '../../../../../modules/docs/infrastructure/browser/supabase-docs-log-query-gateway',
    () => ({
        SupabaseDocsLogQueryGateway: jest.fn().mockImplementation(() => ({
            loadByDocsId: jest.fn().mockResolvedValue({ ok: true, value: null }),
        })),
    }),
);

jest.mock(
    '../../../../../modules/docs/infrastructure/browser/supabase-docs-info-query-gateway',
    () => ({
        SupabaseDocsInfoQueryGateway: jest.fn().mockImplementation(() => ({
            loadByDocsId: jest.fn().mockResolvedValue({ ok: true, value: null }),
        })),
    }),
);

jest.mock(
    '../../../../../modules/docs/infrastructure/browser/supabase-docs-content-query-gateway',
    () => ({
        SupabaseDocsContentQueryGateway: jest.fn().mockImplementation(() => ({
            loadByDocsId: jest.fn().mockResolvedValue({ ok: true, value: null }),
        })),
    }),
);

import { GetDocsContentService } from '@/src/modules/docs/application/get-docs-content';
import { GetDocsInfoService } from '@/src/modules/docs/application/get-docs-info';
import { GetDocsListService } from '@/src/modules/docs/application/get-docs-list';
import { GetDocsLogsService } from '@/src/modules/docs/application/get-docs-logs';
import { ModerateDocsRequestsService } from '@/src/modules/docs/application/moderate-docs-requests';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { SupabaseDocsContentQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-content-query-gateway';
import { SupabaseDocsInfoQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-info-query-gateway';
import { SupabaseDocsListQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-list-query-gateway';
import { SupabaseDocsLogQueryGateway } from '@/src/modules/docs/infrastructure/browser/supabase-docs-log-query-gateway';

describe('browser docs services', () => {
    it('creates all docs read query services with their corresponding Supabase gateways', async () => {
        const services = createBrowserDocsServices();

        expect(services.docsListQueryService).toBeInstanceOf(GetDocsListService);
        expect(services.docsLogsQueryService).toBeInstanceOf(GetDocsLogsService);
        expect(services.docsInfoQueryService).toBeInstanceOf(GetDocsInfoService);
        expect(services.docsContentQueryService).toBeInstanceOf(GetDocsContentService);
        expect(SupabaseDocsListQueryGateway).toHaveBeenCalledTimes(1);
        expect(SupabaseDocsLogQueryGateway).toHaveBeenCalledTimes(1);
        expect(SupabaseDocsInfoQueryGateway).toHaveBeenCalledTimes(1);
        expect(SupabaseDocsContentQueryGateway).toHaveBeenCalledTimes(1);
        await expect(services.docsListQueryService.get()).resolves.toEqual({ ok: true, value: [] });
        await expect(services.docsLogsQueryService.get(1)).resolves.toEqual({ ok: false, error: {
            kind: 'not-found', message: '문서를 찾을 수 없습니다.',
        } });
        await expect(services.docsInfoQueryService.get(1)).resolves.toEqual({ ok: false, error: {
            kind: 'not-found', message: '문서를 찾을 수 없습니다.',
        } });
        await expect(services.docsContentQueryService.get(1)).resolves.toEqual({ ok: false, error: {
            kind: 'not-found', message: '문서를 찾을 수 없습니다.',
        } });
    });

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
