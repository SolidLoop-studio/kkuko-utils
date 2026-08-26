const mockCreateServerSupabaseClient = jest.fn();

jest.mock('../../../../../shared/infrastructure/supabase/server-client', () => ({
    createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

jest.mock('react', () => {
    const actual = jest.requireActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <TArg, TResult>(loader: (argument: TArg) => TResult) => {
            const entries = new Map<TArg, TResult>();
            return (argument: TArg) => {
                if (!entries.has(argument)) entries.set(argument, loader(argument));
                return entries.get(argument) as TResult;
            };
        },
    };
});

import { getServerNotificationDetail } from '@/src/modules/notifications/infrastructure/server/server-notification-services';

describe('server notification detail composition', () => {
    it('deduplicates the metadata and page lookup for the same id through React request cache', async () => {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 17,
                    title: '점검 안내',
                    body: '본문',
                    img: null,
                    created_at: '2026-08-27T01:00:00.000Z',
                    end_at: '2026-08-30T00:00:00.000Z',
                    is_important: false,
                    is_modal: false,
                },
                error: null,
            }),
        };
        const client = { from: jest.fn().mockReturnValue(query) };
        mockCreateServerSupabaseClient.mockResolvedValue(client);

        const metadataResult = await getServerNotificationDetail(17);
        const pageResult = await getServerNotificationDetail(17);

        expect(metadataResult).toEqual(pageResult);
        expect(mockCreateServerSupabaseClient).toHaveBeenCalledTimes(1);
        expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    });
});
