import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';

import WordsAddHome from '../../../app/word/adds/WordsAddHome';
import { useWordThemes } from '../../../modules/word-catalog';
import { useUserWordRequests } from '../../../modules/word-requests';
import { err, ok } from '../../../shared/application/result';

const requestAdditions = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

const expectNoMaximumUpdateDepthError = () => {
    expect(consoleErrorSpy.mock.calls.some(([message]) => (
        typeof message === 'string' && message.includes('Maximum update depth exceeded')
    ))).toBe(false);
};

const flushReactEffects = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('../../../modules/word-catalog', () => ({ useWordThemes: jest.fn() }));
jest.mock('../../../modules/word-requests', () => ({ useUserWordRequests: jest.fn() }));
jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 80,
        getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
            index,
            key: index,
            size: 80,
            start: index * 80,
        })),
    }),
}));
jest.mock('../../../app/word/components/WordAddFrom', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../app/components/CompleteModal', () => ({
    __esModule: true,
    default: ({ title, description }: { title: string; description: string }) => (
        <div role="dialog"><span>{title}</span><span>{description}</span></div>
    ),
}));
jest.mock('../../../app/components/ProgressModal', () => ({
    __esModule: true,
    default: ({
        isModalOpen,
        progress,
        currentTask,
    }: { isModalOpen: boolean; progress: number; currentTask: string }) => (
        isModalOpen ? <div role="progressbar">{progress}|{currentTask}</div> : null
    ),
}));
jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: { ErrName: string; ErrMessage: string; ErrStackRace: string } }) => (
        <div role="alert">{error.ErrName}|{error.ErrMessage}|{error.ErrStackRace}</div>
    ),
}));
jest.mock('../../../app/components/LoginRequiredModal', () => ({
    __esModule: true,
    default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
jest.mock('../../../app/components/HelpModal', () => ({
    __esModule: true,
    default: () => null,
}));

const mockedUseWordThemes = jest.mocked(useWordThemes);

const loadEntries = async () => {
    const user = userEvent.setup();
    render(<WordsAddHome />);
    const file = new File(['가방/animal\n나비/place'], 'words.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: '파일 처리 (1)' }));
    await screen.findByRole('button', { name: '모든 단어 추가 요청' });
    return user;
};

beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(useSelector).mockImplementation((selector) => selector({
        user: { uuid: 'user-1', role: 'r1' },
    } as never));
    mockedUseWordThemes.mockReturnValue({
        data: [
            { id: 1, code: 'animal', name: '동물' },
            { id: 2, code: 'place', name: '지명' },
        ],
        error: undefined,
        isLoading: false,
    } as unknown as ReturnType<typeof useWordThemes>);
    jest.mocked(useUserWordRequests).mockReturnValue({
        requestAddition: jest.fn(),
        requestAdditions,
        requestDeletion: jest.fn(),
        cancel: jest.fn(),
        isPending: false,
        error: null,
        clearError: jest.fn(),
    });
    requestAdditions.mockResolvedValue(ok({
        requestedWordCount: 2,
        createdWordRequestCount: 1,
        updatedWordRequestCount: 0,
        changedRegisteredWordCount: 1,
        createdThemeChangeRequestCount: 1,
        unchangedWordCount: 0,
    }));
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('WordsAddHome addition batch', () => {
    it('shows a safe Korean error when the catalog theme query fails', async () => {
        mockedUseWordThemes.mockReturnValue({
            data: undefined,
            error: { kind: 'infrastructure', message: 'raw SDK diagnostic' },
            isLoading: false,
        } as unknown as ReturnType<typeof useWordThemes>);

        render(<WordsAddHome />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('주제 정보를 불러오는 중 오류가 발생했습니다.');
        expect(alert).not.toHaveTextContent('raw SDK diagnostic');
        await flushReactEffects();
        expect(mockedUseWordThemes.mock.calls.length).toBeLessThan(5);
        expectNoMaximumUpdateDepthError();
    });

    it('submits the edited entries through the feature hook without SCM mutations', async () => {
        const user = await loadEntries();

        await user.click(screen.getByRole('button', { name: '모든 단어 추가 요청' }));

        await waitFor(() => expect(requestAdditions).toHaveBeenCalledWith(
            {
                entries: [
                    { word: '가방', themeCodes: ['animal'] },
                    { word: '나비', themeCodes: ['place'] },
                ],
            },
            expect.any(Function),
        ));
        expect(await screen.findByRole('dialog')).toHaveTextContent('신규 단어 요청 1개');
    });

    it('renders the completed-word percentage reported by atomic batches', async () => {
        let reportProgress: ((progress: {
            completedWordCount: number;
            totalWordCount: number;
        }) => void) | undefined;
        let resolveRequest!: (value: Awaited<ReturnType<typeof requestAdditions>>) => void;
        requestAdditions.mockImplementation((_command, onProgress) => {
            reportProgress = onProgress;
            return new Promise((resolve) => {
                resolveRequest = resolve;
            });
        });
        const user = await loadEntries();

        await user.click(screen.getByRole('button', { name: '모든 단어 추가 요청' }));
        expect(await screen.findByRole('progressbar')).toHaveTextContent('0|대량 요청 준비중... 0 / 2');

        act(() => reportProgress?.({ completedWordCount: 300, totalWordCount: 301 }));
        expect(screen.getByRole('progressbar')).toHaveTextContent('99|대량 요청 처리중... 300 / 301');

        act(() => reportProgress?.({ completedWordCount: 301, totalWordCount: 301 }));
        expect(screen.getByRole('progressbar')).toHaveTextContent('100|대량 요청 처리중... 301 / 301');

        await act(async () => resolveRequest(ok({
            requestedWordCount: 2,
            createdWordRequestCount: 2,
            updatedWordRequestCount: 0,
            changedRegisteredWordCount: 0,
            createdThemeChangeRequestCount: 0,
            unchangedWordCount: 0,
        })));
    });

    it('shows a stable application error and leaves the entries available for retry', async () => {
        requestAdditions.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터 처리 중 오류가 발생했습니다.',
            code: 'P0001',
        }));
        const user = await loadEntries();

        await user.click(screen.getByRole('button', { name: '모든 단어 추가 요청' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'ApplicationError:infrastructure|데이터 처리 중 오류가 발생했습니다.|P0001',
        );
        expect(screen.getByRole('button', { name: '모든 단어 추가 요청' })).toBeEnabled();
    });
});
