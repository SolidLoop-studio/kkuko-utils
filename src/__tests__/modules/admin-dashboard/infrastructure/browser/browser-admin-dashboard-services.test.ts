jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { GetAdminDashboardSummaryService } from '@/src/modules/admin-dashboard/application/get-admin-dashboard-summary';
import { GetAdminDashboardSummaryService as PublicGetAdminDashboardSummaryService } from '@/src/modules/admin-dashboard';
import { createBrowserAdminDashboardServices } from '@/src/modules/admin-dashboard/infrastructure/browser/browser-admin-dashboard-services';

describe('createBrowserAdminDashboardServices', () => {
    test('composes and publicly exports the admin summary query service', () => {
        // Break caught: leaving the dashboard hook without a browser composition root/public use case.
        expect(createBrowserAdminDashboardServices().adminDashboardSummaryService).toBeInstanceOf(
            GetAdminDashboardSummaryService,
        );
        expect(PublicGetAdminDashboardSummaryService).toBe(GetAdminDashboardSummaryService);
    });
});
