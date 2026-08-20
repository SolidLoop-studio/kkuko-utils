const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

describe('browser word moderation services', () => {
    afterEach(() => {
        if (indexedDbDescriptor === undefined) {
            Reflect.deleteProperty(globalThis, 'indexedDB');
        } else {
            Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
        }

        if (supabaseUrl === undefined) {
            Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SUPABASE_URL');
        } else {
            process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
        }
        if (supabaseAnonKey === undefined) {
            Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
        } else {
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
        }

        jest.resetModules();
    });

    it('returns one stable singleton with approval and deletion services', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
        jest.resetModules();

        jest.isolateModules(() => {
            const { RunWordApprovalService } = require('../../../../../modules/word-moderation/application/run-word-approval');
            const { RunWordDeletionService } = require('../../../../../modules/word-moderation/application/run-word-deletion');
            const { createBrowserWordModerationServices } = require('../../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services');

            const first = createBrowserWordModerationServices();
            const second = createBrowserWordModerationServices();

            expect(first).toBe(second);
            expect(first.wordApprovalService).toBeInstanceOf(RunWordApprovalService);
            expect(first.wordDeletionService).toBeInstanceOf(RunWordDeletionService);
        });
    });

    it('SSR module import does not access IndexedDB', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            value: undefined,
        });
        jest.resetModules();

        expect(() => {
            jest.isolateModules(() => {
                require('../../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services');
            });
        }).not.toThrow();
    });

    it('SSR hook render does not access IndexedDB', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            value: undefined,
        });
        jest.resetModules();

        expect(() => {
            jest.isolateModules(() => {
                const React = require('react');
                const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
                const { renderToStaticMarkup } = require('react-dom/server');
                const { useWordApproval } = require('../../../../../modules/word-moderation/presentation/use-word-approval');

                const ApprovalHookOnServer = () => {
                    useWordApproval();
                    return React.createElement('div');
                };
                const queryClient = new QueryClient();

                renderToStaticMarkup(
                    React.createElement(
                        QueryClientProvider,
                        { client: queryClient },
                        React.createElement(ApprovalHookOnServer),
                    ),
                );
            });
        }).not.toThrow();
    });
});
