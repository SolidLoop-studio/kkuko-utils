import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Database } from '../../../app/types/database.types';
import AddWordsHome from '../../../app/admin/add-words/AddWordsHome';
import { userReducer } from '../../../app/store/slice';

const mockAllDocs = jest.fn();
const mockAllThemes = jest.fn();
const mockAllWaitWords = jest.fn();
const mockAllWordWaitTheme = jest.fn();
const mockWaitWordsThemes = jest.fn();
const mockWordsByWords = jest.fn();
const mockAddWords = jest.fn();
const mockAddWordsThemes = jest.fn();
const mockAddWordLog = jest.fn();
const mockAddDocsLog = jest.fn();
const mockDeleteWordTheme = jest.fn();
const mockDeleteWordsWaitThemesByIds = jest.fn();
const mockDeleteWaitWordsByIds = jest.fn();
const mockUpdateContribution = jest.fn();
const mockUpdateDocsLastUpdate = jest.fn();

async function mockSupabaseInQueryChunk<T, P>(
    values: P[],
    fn: (chunk: P[]) => Promise<{ data: T | null; error: unknown }>,
    options: { onProgress?: (processed: number, total: number, current: number, chunks: number) => void } = {},
) {
    if (values.length === 0) {
        return { data: [], error: null, count: 0 };
    }

    const result = await fn(values);
    options.onProgress?.(values.length, values.length, 1, 1);

    if (result.error) {
        return { data: null, error: result.error, count: null };
    }

    const data = result.data === null ? [] : Array.isArray(result.data) ? result.data : [result.data];
    return { data, error: null, count: data.length };
}

jest.mock('../../../app/lib/supabaseClient', () => {
    return {
        supabaseInQueryChunk: mockSupabaseInQueryChunk,
        SCM: {
            get: () => ({
                allDocs: mockAllDocs,
                allThemes: mockAllThemes,
                allWaitWords: mockAllWaitWords,
                allWordWaitTheme: mockAllWordWaitTheme,
                waitWordsThemes: mockWaitWordsThemes,
                wordsByWords: mockWordsByWords,
            }),
            add: () => ({
                words: mockAddWords,
                wordsThemes: mockAddWordsThemes,
                wordLog: mockAddWordLog,
                docsLog: mockAddDocsLog,
            }),
            delete: () => ({
                wordTheme: mockDeleteWordTheme,
                wordsWaitThemesByIds: mockDeleteWordsWaitThemesByIds,
                waitWordsByIds: mockDeleteWaitWordsByIds,
            }),
            update: () => ({
                userContribution: mockUpdateContribution,
                docsLastUpdate: mockUpdateDocsLastUpdate,
            }),
        },
    };
});

type DocsRow = Database['public']['Tables']['docs']['Row'];
type ThemeRow = Database['public']['Tables']['themes']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type WaitWordRow = Database['public']['Tables']['wait_words']['Row'];
type WordRow = Database['public']['Tables']['words']['Row'];
type WordThemeWaitRow = Database['public']['Tables']['word_themes_wait']['Row'];

const adminId = 'admin-id';
const requesterId = 'requester-id';
const waitWordId = 101;

const response = <T,>(data: T): PostgrestSingleResponse<T> => ({
    data,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
});

const docs = (id: number, name: string, typez: DocsRow['typez']): DocsRow & { users: UserRow | null } => ({
    id,
    name,
    typez,
    duem: false,
    maker: null,
    is_hidden: false,
    views: 0,
    created_at: '2026-08-20T00:00:00.000Z',
    last_update: '2026-08-20T00:00:00.000Z',
    users: null,
});

const theme = (id: number, code: string, name: string): ThemeRow => ({ id, code, name });

const word = (id: number, value: string): WordRow => ({
    id,
    word: value,
    k_canuse: true,
    noin_canuse: true,
    mission_mark: 0,
    added_by: null,
    added_at: '2026-08-20T00:00:00.000Z',
    chosungs: null,
    first_letter: null,
    last_letter: null,
    length: null,
});

const renderAddWordsHome = () => {
    const store = configureStore({
        reducer: { user: userReducer },
        preloadedState: {
            user: { username: '관리자', uuid: adminId, role: 'admin' as const },
        },
    });

    return render(
        <Provider store={store}>
            <AddWordsHome />
        </Provider>,
    );
};

const uploadAndProcess = async (json: Record<string, string[]>) => {
    const user = userEvent.setup();
    const file = new File([JSON.stringify(json)], 'words.json', { type: 'application/json' });
    const fileInput = document.querySelector<HTMLInputElement>('#file-upload');

    if (!fileInput) {
        throw new Error('File upload input was not rendered.');
    }

    await user.upload(fileInput, file);
    await user.click(await screen.findByRole('button', { name: '처리 시작' }));
};

beforeEach(() => {
    mockAllDocs.mockResolvedValue(response([]));
    mockAllThemes.mockResolvedValue(response([]));
    mockAllWaitWords.mockResolvedValue(response([]));
    mockAllWordWaitTheme.mockResolvedValue(response([]));
    mockWaitWordsThemes.mockResolvedValue({ data: [], error: null });
    mockWordsByWords.mockResolvedValue(response([]));
    mockAddWords.mockResolvedValue(response([]));
    mockAddWordsThemes.mockResolvedValue(response([]));
    mockAddWordLog.mockResolvedValue(response(null));
    mockAddDocsLog.mockResolvedValue(response(null));
    mockDeleteWordTheme.mockResolvedValue(response([]));
    mockDeleteWordsWaitThemesByIds.mockResolvedValue(response(null));
    mockDeleteWaitWordsByIds.mockResolvedValue(response(null));
    mockUpdateContribution.mockResolvedValue(response(undefined));
    mockUpdateDocsLastUpdate.mockResolvedValue(undefined);
});

describe('AddWordsHome current approval orchestration', () => {
    it('records the current new-word approval result from JSON upload through completion', async () => {
        mockAllDocs.mockResolvedValue(response([
            docs(1, '비', 'letter'),
            docs(10, '주제10', 'theme'),
            docs(20, '주제20', 'theme'),
        ]));
        mockAllThemes.mockResolvedValue(response([
            theme(10, '10', '주제10'),
            theme(20, '20', '주제20'),
        ]));
        mockAllWaitWords.mockResolvedValue(response<WaitWordRow[]>([
            {
                id: waitWordId,
                word: '나비',
                word_id: null,
                requested_by: requesterId,
                request_type: 'add',
                status: 'pending',
                requested_at: '2026-08-20T00:00:00.000Z',
                words: null,
                users: null,
            },
        ] as (WaitWordRow & { words: WordRow | null; users: UserRow | null })[]));
        mockAddWords.mockResolvedValue(response([word(201, '나비')]));
        mockAddWordsThemes.mockResolvedValue(response([
            { words: { word: '나비' }, themes: { name: '주제10' } },
            { words: { word: '나비' }, themes: { name: '주제20' } },
        ]));

        renderAddWordsHome();
        await uploadAndProcess({ 나비: ['10', '20'] });

        await waitFor(() => {
            expect(mockAddWords).toHaveBeenCalledWith([
                { word: '나비', k_canuse: true, noin_canuse: true, added_by: requesterId },
            ]);
            expect(mockAddWordLog).toHaveBeenCalledWith([
                expect.objectContaining({
                    word: '나비',
                    processed_by: adminId,
                    make_by: requesterId,
                    r_type: 'add',
                    state: 'approved',
                }),
            ]);
            expect(mockUpdateContribution).toHaveBeenCalledWith({ userId: requesterId, amount: 1 });
            expect(mockDeleteWaitWordsByIds).toHaveBeenCalledWith([waitWordId]);
            expect(screen.getByText('처리가 완료되었습니다!')).toBeInTheDocument();
        });
    });

    it('records the current canonical-theme replacement for an existing word', async () => {
        const existingWordId = 301;
        const theme10 = theme(10, '10', '주제10');
        const theme20 = theme(20, '20', '주제20');
        const theme30 = theme(30, '30', '주제30');
        const waitThemeRow: WordThemeWaitRow = {
            word_id: existingWordId,
            theme_id: theme30.id,
            typez: 'delete',
            req_by: requesterId,
            req_at: '2026-08-20T00:00:00.000Z',
        };

        mockAllDocs.mockResolvedValue(response([
            docs(20, theme20.name, 'theme'),
            docs(30, theme30.name, 'theme'),
        ]));
        mockAllThemes.mockResolvedValue(response([theme10, theme20, theme30]));
        mockAllWordWaitTheme.mockResolvedValue(response([
            {
                ...waitThemeRow,
                words: { word: '고양이', id: existingWordId },
                themes: theme30,
                users: null,
            },
        ]));
        mockWordsByWords.mockResolvedValue(response([
            { ...word(existingWordId, '고양이'), wthemes: [theme10.id, theme30.id] },
        ]));
        mockAddWordsThemes.mockResolvedValue(response([
            { words: { word: '고양이' }, themes: { name: theme20.name } },
        ]));
        mockDeleteWordTheme.mockResolvedValue(response([
            {
                word_id: existingWordId,
                word: '고양이',
                theme_id: theme30.id,
                theme_name: theme30.name,
            },
        ]));

        renderAddWordsHome();
        await uploadAndProcess({ 고양이: ['10', '20'] });

        await waitFor(() => {
            expect(mockAddWordsThemes).toHaveBeenCalledWith([
                { word_id: existingWordId, theme_id: theme10.id },
                { word_id: existingWordId, theme_id: theme20.id },
            ]);
            expect(mockDeleteWordTheme).toHaveBeenCalledWith([
                { word_id: existingWordId, theme_id: theme30.id },
                { word_id: existingWordId, theme_id: theme30.id },
            ]);
            expect(mockAddDocsLog).toHaveBeenCalledWith(expect.arrayContaining([
                { docs_id: 20, word: '고양이', add_by: adminId, type: 'add' },
                { docs_id: 30, word: '고양이', add_by: requesterId, type: 'delete' },
            ]));
            expect(mockUpdateDocsLastUpdate).toHaveBeenCalledWith(expect.arrayContaining([20, 30]));
            expect(mockDeleteWordsWaitThemesByIds).toHaveBeenCalledWith([existingWordId]);
            expect(screen.getByText('처리가 완료되었습니다!')).toBeInTheDocument();
        });
    });
});
