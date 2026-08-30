jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { GetWordLogPageService } from '@/src/modules/word-logs/application/get-word-log-page';
import { GetWordLogPageService as PublicGetWordLogPageService } from '@/src/modules/word-logs';
import { createBrowserWordLogServices } from '@/src/modules/word-logs/infrastructure/browser/browser-word-log-services';

describe('createBrowserWordLogServices', () => {
    test('composes and publicly exports the browser page-query service', () => {
        // Break caught: leaving the feature hook without a composed/public Application use case.
        expect(createBrowserWordLogServices().wordLogPageQueryService).toBeInstanceOf(
            GetWordLogPageService,
        );
        expect(PublicGetWordLogPageService).toBe(GetWordLogPageService);
    });
});
