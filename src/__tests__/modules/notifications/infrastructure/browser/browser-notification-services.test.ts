import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { from: jest.fn() },
}));

import { createBrowserNotificationServices } from '@/src/modules/notifications/infrastructure/browser/browser-notification-services';

describe('browser notification composition', () => {
    it('exposes only the modal query service and composes no notification mutations', () => {
        const source = readFileSync(resolve(
            process.cwd(),
            'src/modules/notifications/infrastructure/browser/browser-notification-services.ts',
        ), 'utf8');

        expect(Object.keys(createBrowserNotificationServices())).toEqual([
            'modalNoticeQueryService',
        ]);
        expect(source).not.toContain('SaveNotificationService');
        expect(source).not.toContain('DeleteNotificationService');
        expect(source).not.toContain('SupabaseNotificationWriteCommandGateway');
        expect(source).not.toContain('SupabaseNotificationDeleteCommandGateway');
        expect(source).not.toContain('SupabaseNotificationImageStorage');
    });
});
