const createBrowserClient = jest.fn(() => ({ client: 'browser' }));
const createServerClient = jest.fn(() => ({ client: 'server' }));
const createClient = jest.fn(() => ({ client: 'service' }));
const cookieStore = {
    getAll: jest.fn(() => []),
    set: jest.fn(),
};

jest.mock('@supabase/ssr', () => ({
    createBrowserClient,
    createServerClient,
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient,
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn(async () => cookieStore),
}));

jest.mock('server-only', () => ({}));

describe('Supabase client boundaries', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
        process.env.SUPABASE_SERVICE_KEY = 'service-key';
        jest.clearAllMocks();
        jest.resetModules();
    });

    it('browser factory를 module당 한 번만 만들고 legacy export와 같은 instance를 사용한다', async () => {
        const { browserSupabaseClient } = await import('@/src/shared/infrastructure/supabase/browser-client');
        const { supabase } = await import('@/src/app/lib/supabaseClient');

        expect(createBrowserClient).toHaveBeenCalledTimes(1);
        expect(supabase).toBe(browserSupabaseClient);
    });

    it('server factory는 호출마다 새 instance를 반환한다', async () => {
        const { createServerSupabaseClient } = await import('@/src/shared/infrastructure/supabase/server-client');

        const first = await createServerSupabaseClient();
        const second = await createServerSupabaseClient();

        expect(createServerClient).toHaveBeenCalledTimes(2);
        expect(first).not.toBe(second);
    });

    it('service factory는 SUPABASE_SERVICE_KEY를 사용한다', async () => {
        const { createServiceSupabaseClient } = await import('@/src/shared/infrastructure/supabase/service-client');

        createServiceSupabaseClient();

        expect(createClient).toHaveBeenCalledWith(
            'https://example.supabase.co',
            'service-key',
        );
    });

    it('public factory는 쿠키 없이 anon key와 비지속 인증 설정을 사용한다', async () => {
        const { createPublicSupabaseClient } = await import('@/src/shared/infrastructure/supabase/public-client');

        createPublicSupabaseClient();

        expect(createClient).toHaveBeenCalledWith(
            'https://example.supabase.co',
            'anon-key',
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            },
        );
        expect(cookieStore.getAll).not.toHaveBeenCalled();
    });
});
