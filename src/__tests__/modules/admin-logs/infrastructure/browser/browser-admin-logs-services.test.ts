jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { GetAdminLogsInitialService } from '@/src/modules/admin-logs/application/get-admin-logs-initial';
import { createBrowserAdminLogsServices } from '@/src/modules/admin-logs/infrastructure/browser/browser-admin-logs-services';

describe('createBrowserAdminLogsServices', () => {
    test('composes the browser initial-query service', () => {
        // Break caught: leaving the feature hook without its browser Application service.
        expect(createBrowserAdminLogsServices().adminLogsInitialQueryService).toBeInstanceOf(
            GetAdminLogsInitialService,
        );
    });
});
