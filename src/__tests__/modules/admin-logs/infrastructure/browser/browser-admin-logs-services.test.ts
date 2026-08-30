jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { DeleteAdminLogsService } from '@/src/modules/admin-logs/application/delete-admin-logs';
import { GetAdminLogsInitialService } from '@/src/modules/admin-logs/application/get-admin-logs-initial';
import { GetAdminLogsPageService } from '@/src/modules/admin-logs/application/get-admin-logs-page';
import {
    DeleteAdminLogsService as PublicDeleteAdminLogsService,
    GetAdminLogsPageService as PublicGetAdminLogsPageService,
} from '@/src/modules/admin-logs';
import { createBrowserAdminLogsServices } from '@/src/modules/admin-logs/infrastructure/browser/browser-admin-logs-services';

describe('createBrowserAdminLogsServices', () => {
    test('composes the browser initial-query service', () => {
        // Break caught: leaving the feature hook without its browser Application service.
        expect(createBrowserAdminLogsServices().adminLogsInitialQueryService).toBeInstanceOf(
            GetAdminLogsInitialService,
        );
    });

    test('composes the browser filtered-page query service', () => {
        // Break caught: leaving the upcoming page-query hook without its browser Application service.
        expect(createBrowserAdminLogsServices().adminLogsPageQueryService).toBeInstanceOf(
            GetAdminLogsPageService,
        );
    });

    test('composes the browser selected-delete command service', () => {
        // Break caught: leaving the command hook without its browser Application service.
        expect(createBrowserAdminLogsServices().adminLogDeleteService).toBeInstanceOf(
            DeleteAdminLogsService,
        );
    });

    test('exports the filtered-page Application service from the module boundary', () => {
        // Break caught: requiring Presentation to deep-import a non-public page-query use case.
        expect(PublicGetAdminLogsPageService).toBe(GetAdminLogsPageService);
    });

    test('exports the selected-delete Application service from the module boundary', () => {
        // Break caught: requiring Presentation to deep-import a non-public command use case.
        expect(PublicDeleteAdminLogsService).toBe(DeleteAdminLogsService);
    });
});
