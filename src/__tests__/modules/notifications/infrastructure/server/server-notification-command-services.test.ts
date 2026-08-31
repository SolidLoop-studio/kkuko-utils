import { err, ok } from '@/src/shared/application/result';
import {
    authorizeNotificationManager,
    type NotificationAuthorizationClient,
} from '@/src/modules/notifications/infrastructure/server/server-notification-command-services';

const unauthorized = err({ kind: 'unauthorized', message: '로그인이 필요합니다.' });
const forbidden = err({ kind: 'forbidden', message: '공지사항 관리 권한이 없습니다.' });
const infrastructure = err({ kind: 'infrastructure', message: '공지사항 권한을 확인하지 못했습니다.' });

const createClient = (user: unknown, roleResponse: unknown): NotificationAuthorizationClient => {
    const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(roleResponse),
    };
    return {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
        from: jest.fn().mockReturnValue(query),
    };
};

describe('authorizeNotificationManager', () => {
    it('rejects an unauthenticated request before querying a role', async () => {
        const client = createClient(null, { data: { role: 'r4' }, error: null });

        await expect(authorizeNotificationManager(client)).resolves.toEqual(unauthorized);
        expect(client.from).not.toHaveBeenCalled();
    });

    it('forbids a missing user role', async () => {
        await expect(authorizeNotificationManager(createClient({ id: 'user-1' }, { data: null, error: null })))
            .resolves.toEqual(forbidden);
    });

    it('keeps returned and thrown role failures secret', async () => {
        const returned = createClient({ id: 'user-1' }, { data: null, error: { message: 'raw role error' } });
        const thrown = createClient({ id: 'user-1' }, { data: null, error: null });
        const query = thrown.from('users');
        query.maybeSingle = jest.fn().mockRejectedValue(new Error('raw role network error'));

        await expect(authorizeNotificationManager(returned)).resolves.toEqual(infrastructure);
        await expect(authorizeNotificationManager(thrown)).resolves.toEqual(infrastructure);
    });

    it.each(['r1', 'r2', 'r3'] as const)('forbids the %s role', async (role) => {
        await expect(authorizeNotificationManager(createClient({ id: 'user-1' }, { data: { role }, error: null })))
            .resolves.toEqual(forbidden);
    });

    it.each(['r4', 'admin'] as const)('authorizes the %s role', async (role) => {
        await expect(authorizeNotificationManager(createClient({ id: 'user-1' }, { data: { role }, error: null })))
            .resolves.toEqual(ok(undefined));
    });
});
