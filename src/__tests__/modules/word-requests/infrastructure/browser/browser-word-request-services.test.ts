jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { ManageUserWordRequestsService } from '@/src/modules/word-requests/application/manage-user-word-requests';
import { RequestWordThemeChangesService } from '@/src/modules/word-requests/application/request-word-theme-changes';
import { createBrowserWordRequestServices } from '@/src/modules/word-requests/infrastructure/browser/browser-word-request-services';

describe('browser word request services', () => {
    it('creates a theme-change service wired to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { rpc: jest.Mock } };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: {
                word: '나비',
                changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }],
            },
            error: null,
        });

        const services = createBrowserWordRequestServices();

        expect(services.userWordThemeRequestService).toBeInstanceOf(RequestWordThemeChangesService);
        await expect(services.userWordThemeRequestService.execute({
            word: ' 나비 ',
            changes: [{ themeCode: ' A ', type: 'add' }],
        })).resolves.toEqual({
            ok: true,
            value: {
                word: '나비',
                changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }],
            },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('request_word_theme_changes', {
            p_word: '나비',
            p_changes: [{ themeCode: 'A', type: 'add' }],
        });
    });

    it('creates fresh user word request services wired to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as {
            browserSupabaseClient: { rpc: jest.Mock };
        };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: { requestId: 11, word: '나비', requestType: 'delete' },
            error: null,
        });

        const first = createBrowserWordRequestServices();
        const second = createBrowserWordRequestServices();

        expect(first.userWordRequestService).toBeInstanceOf(ManageUserWordRequestsService);
        expect(second.userWordRequestService).toBeInstanceOf(ManageUserWordRequestsService);
        expect(first.userWordRequestService).not.toBe(second.userWordRequestService);
        await expect(first.userWordRequestService.requestDeletion({ word: ' 나비 ' })).resolves.toEqual({
            ok: true,
            value: { requestId: 11, word: '나비', requestType: 'delete' },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('request_word_deletion', {
            p_word: '나비',
        });
    });

    it('wires user word addition requests to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { rpc: jest.Mock } };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: {
                requestId: 10,
                word: '가방',
                requestType: 'add',
                themes: [{ themeCode: 'animal', themeName: '동물' }],
            },
            error: null,
        });

        const services = createBrowserWordRequestServices();

        await expect(services.userWordRequestService.requestAddition({
            word: ' 가방 ',
            themeCodes: [' animal '],
        })).resolves.toMatchObject({
            ok: true,
            value: { requestId: 10, word: '가방', requestType: 'add' },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('request_word_addition', {
            p_word: '가방',
            p_theme_codes: ['animal'],
        });
    });

    it('wires user word addition batches to the Supabase gateway', async () => {
        const { browserSupabaseClient } = jest.requireMock(
            '../../../../../shared/infrastructure/supabase/browser-client',
        ) as { browserSupabaseClient: { rpc: jest.Mock } };
        browserSupabaseClient.rpc.mockResolvedValue({
            data: {
                requestedWordCount: 1,
                createdWordRequestCount: 1,
                updatedWordRequestCount: 0,
                changedRegisteredWordCount: 0,
                createdThemeChangeRequestCount: 0,
                unchangedWordCount: 0,
            },
            error: null,
        });

        const services = createBrowserWordRequestServices();

        await expect(services.userWordRequestService.requestAdditions({
            entries: [{ word: ' 가방 ', themeCodes: [' animal '] }],
        })).resolves.toMatchObject({
            ok: true,
            value: { requestedWordCount: 1, createdWordRequestCount: 1 },
        });
        expect(browserSupabaseClient.rpc).toHaveBeenCalledWith('request_word_additions', {
            p_entries: [{ word: '가방', themeCodes: ['animal'] }],
        });
    });
});
