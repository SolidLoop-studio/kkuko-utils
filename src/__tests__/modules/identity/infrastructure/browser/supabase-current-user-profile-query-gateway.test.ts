jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: {},
}));

import { SupabaseCurrentUserProfileQueryGateway } from '@/src/modules/identity/infrastructure/browser/supabase-current-user-profile-query-gateway';
import { err, ok } from '@/src/shared/application/result';

const createGateway = (response: unknown) => {
    const maybeSingle = jest.fn().mockResolvedValue(response);
    const builder = {
        eq: jest.fn(),
        maybeSingle,
        select: jest.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    const from = jest.fn((_table: 'users') => builder);
    return {
        eq: builder.eq,
        from,
        gateway: new SupabaseCurrentUserProfileQueryGateway({ from }),
        maybeSingle,
        select: builder.select,
    };
};

describe('SupabaseCurrentUserProfileQueryGateway', () => {
    test('selects and maps only the public current-user profile fields', async () => {
        // Break caught: coupling identity presentation to a full generated users row.
        const { eq, from, gateway, select } = createGateway({
            data: { id: 'user-1', nickname: '테스터', role: null, contribution: 999 },
            error: null,
        });

        await expect(gateway.loadByUserId('user-1')).resolves.toEqual(ok({
            id: 'user-1',
            nickname: '테스터',
            role: 'guest',
        }));
        expect(from).toHaveBeenCalledWith('users');
        expect(select).toHaveBeenCalledWith('id, nickname, role');
        expect(eq).toHaveBeenCalledWith('id', 'user-1');
    });

    test('preserves a missing profile as null', async () => {
        // Break caught: preventing authenticated first-time users from reaching nickname registration.
        const { gateway } = createGateway({ data: null, error: null });

        await expect(gateway.loadByUserId('user-1')).resolves.toEqual(ok(null));
    });

    test.each([
        ['a database error', { data: null, error: { message: 'row policy details' } }],
        ['a malformed row', { data: { id: 'user-1', nickname: null, role: 'admin' }, error: null }],
        ['an unknown role', { data: { id: 'user-1', nickname: '테스터', role: 'owner' }, error: null }],
    ])('maps %s to one stable profile error', async (_description, response) => {
        // Break caught: leaking database errors or invalid row values into Redux.
        const { gateway } = createGateway(response);

        await expect(gateway.loadByUserId('user-1')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
        }));
    });
});
