jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({ browserSupabaseClient: {} }));

import { SupabaseAdminAccessTokenProvider } from '@/src/modules/admin-api-server/infrastructure/browser/supabase-admin-access-token-provider';
import { err, ok } from '@/src/shared/application/result';

const unauthorized = err({ kind: 'unauthorized' as const, message: '관리자 인증이 필요합니다.' });
const infrastructure = err({ kind: 'infrastructure' as const, message: '인증 정보를 확인하는 중 오류가 발생했습니다.' });

describe('SupabaseAdminAccessTokenProvider', () => {
    test('returns only a nonblank current-session access token to the HTTP gateway', async () => {
        // Break caught: forwarding a blank token or reading a token from any source other than the browser session.
        const getSession = jest.fn().mockResolvedValue({ data: { session: { access_token: 'admin-token' } }, error: null });

        await expect(new SupabaseAdminAccessTokenProvider({ auth: { getSession } } as never).getAccessToken())
            .resolves.toEqual(ok('admin-token'));
        expect(getSession).toHaveBeenCalledTimes(1);
    });

    test.each([
        [{ data: { session: null }, error: null }],
        [{ data: { session: { access_token: '' } }, error: null }],
        [{ data: { session: { access_token: '   ' } }, error: null }],
    ])('maps a missing or blank session token to the stable unauthorized error', async (response) => {
        // Break caught: issuing an authenticated API call with an absent credential.
        const getSession = jest.fn().mockResolvedValue(response);

        await expect(new SupabaseAdminAccessTokenProvider({ auth: { getSession } } as never).getAccessToken())
            .resolves.toEqual(unauthorized);
    });

    test('maps returned and thrown Supabase failures without exposing their diagnostic', async () => {
        // Break caught: leaking an SDK error message from session retrieval into the admin screen.
        const returned = new SupabaseAdminAccessTokenProvider({
            auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'private auth detail' } }) },
        } as never);
        const thrown = new SupabaseAdminAccessTokenProvider({
            auth: { getSession: jest.fn().mockRejectedValue(new Error('private auth detail')) },
        } as never);

        await expect(returned.getAccessToken()).resolves.toEqual(infrastructure);
        await expect(thrown.getAccessToken()).resolves.toEqual(infrastructure);
    });
});
