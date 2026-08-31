const mockCreateServerSupabaseClient = jest.fn();
const mockCreatePublicSupabaseClient = jest.fn();
type RequestCache = Map<(...args: never[]) => unknown, Map<unknown, unknown>>;
let mockActiveRequestCache: RequestCache | null = null;

const runInMockRequest = async <T>(callback: () => Promise<T>): Promise<T> => {
    const previous = mockActiveRequestCache;
    mockActiveRequestCache = new Map();
    try {
        return await callback();
    } finally {
        mockActiveRequestCache = previous;
    }
};

jest.mock('../../../../../shared/infrastructure/supabase/server-client', () => ({
    createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

jest.mock('../../../../../shared/infrastructure/supabase/public-client', () => ({
    createPublicSupabaseClient: () => mockCreatePublicSupabaseClient(),
}));

jest.mock('server-only', () => ({}));

jest.mock('react', () => {
    const actual = jest.requireActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <TArg, TResult>(loader: (argument: TArg) => TResult) => {
            return (argument: TArg) => {
                if (mockActiveRequestCache === null) return loader(argument);
                let entries = mockActiveRequestCache.get(loader as never);
                if (entries === undefined) {
                    entries = new Map();
                    mockActiveRequestCache.set(loader as never, entries);
                }
                if (!entries.has(argument)) entries.set(argument, loader(argument));
                return entries.get(argument) as TResult;
            };
        },
    };
});

jest.mock('next/cache', () => ({
    unstable_cache: <TArgs extends unknown[], TResult>(loader: (...args: TArgs) => TResult) => {
        const globalEntries = new Map<string, TResult>();
        return (...args: TArgs) => {
            const key = JSON.stringify(args);
            if (!globalEntries.has(key)) globalEntries.set(key, loader(...args));
            return globalEntries.get(key) as TResult;
        };
    },
}));

import {
    getFreshServerNotificationDetail,
    getServerNotificationDetail,
} from '@/src/modules/notifications/infrastructure/server/server-notification-services';

describe('server notification detail composition', () => {
    const createQuery = (title: string) => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 17,
                    title,
                    body: '본문',
                    img: null,
                    created_at: '2026-08-27T01:00:00.000Z',
                    end_at: '2026-08-30T00:00:00.000Z',
                    is_important: false,
                    is_modal: false,
                    views: 40,
                },
                error: null,
            }),
        });

    it('shares cached public detail reads within and across requests while keeping IDs separate', async () => {
        const firstQuery = createQuery('17번 공지');
        const secondQuery = createQuery('18번 공지');
        mockCreatePublicSupabaseClient
            .mockReturnValueOnce({ from: jest.fn().mockReturnValue(firstQuery) })
            .mockReturnValueOnce({ from: jest.fn().mockReturnValue(secondQuery) });

        const firstRequest = await runInMockRequest(async () => {
            const metadataResult = await getServerNotificationDetail(17);
            const pageResult = await getServerNotificationDetail(17);
            return { metadataResult, pageResult };
        });
        const secondRequestResult = await runInMockRequest(
            () => getServerNotificationDetail(17),
        );
        const differentIdResult = await runInMockRequest(
            () => getServerNotificationDetail(18),
        );

        expect(firstRequest.metadataResult).toEqual(firstRequest.pageResult);
        expect(firstRequest.metadataResult).toEqual(expect.objectContaining({
            ok: true,
            value: expect.objectContaining({ title: '17번 공지' }),
        }));
        expect(secondRequestResult).toEqual(expect.objectContaining({
            ok: true,
            value: expect.objectContaining({ title: '17번 공지' }),
        }));
        expect(differentIdResult).toEqual(expect.objectContaining({
            ok: true,
            value: expect.objectContaining({ title: '18번 공지' }),
        }));
        expect(mockCreatePublicSupabaseClient).toHaveBeenCalledTimes(2);
        expect(firstQuery.maybeSingle).toHaveBeenCalledTimes(1);
        expect(secondQuery.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('creates a new authenticated client for each fresh detail read', async () => {
        const firstQuery = createQuery('첫 편집 조회');
        const secondQuery = createQuery('두 번째 편집 조회');
        mockCreateServerSupabaseClient
            .mockResolvedValueOnce({ from: jest.fn().mockReturnValue(firstQuery) })
            .mockResolvedValueOnce({ from: jest.fn().mockReturnValue(secondQuery) });

        const first = await getFreshServerNotificationDetail(17);
        const second = await getFreshServerNotificationDetail(17);

        expect(first).toEqual(expect.objectContaining({
            ok: true,
            value: expect.objectContaining({ title: '첫 편집 조회' }),
        }));
        expect(second).toEqual(expect.objectContaining({
            ok: true,
            value: expect.objectContaining({ title: '두 번째 편집 조회' }),
        }));
        expect(mockCreateServerSupabaseClient).toHaveBeenCalledTimes(2);
        expect(firstQuery.maybeSingle).toHaveBeenCalledTimes(1);
        expect(secondQuery.maybeSingle).toHaveBeenCalledTimes(1);
    });
});
