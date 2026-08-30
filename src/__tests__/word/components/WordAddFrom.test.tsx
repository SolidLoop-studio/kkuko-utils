import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import WordAddForm from '../../../app/word/components/WordAddFrom';
import { useWordThemes } from '../../../modules/word-catalog';

jest.mock('../../../modules/word-catalog', () => ({ useWordThemes: jest.fn() }));
jest.mock('../../../app/components/ui/card', () => ({
    Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
jest.mock('../../../app/components/HelpModal', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: ErrorMessage }) => (
        <div role="alert">{error.ErrMessage}</div>
    ),
}));

const mockedUseWordThemes = jest.mocked(useWordThemes);

const themes = [
    { id: 1, code: 'animal', name: '동물' },
    { id: 2, code: 'game', name: '게임' },
];

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

beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedUseWordThemes.mockReturnValue({
        data: themes,
        error: undefined,
        isLoading: false,
    } as unknown as ReturnType<typeof useWordThemes>);
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('WordAddForm theme loading', () => {
    it('disables saving without an update-depth error while the catalog themes are loading', async () => {
        mockedUseWordThemes.mockReturnValue({
            data: undefined,
            error: undefined,
            isLoading: true,
        } as unknown as ReturnType<typeof useWordThemes>);

        render(<WordAddForm saveFn={jest.fn()} initWord="나비" />);

        await flushReactEffects();
        expect(screen.getAllByRole('button', { name: '단어 저장' }).at(-1)).toBeDisabled();
        expect(mockedUseWordThemes.mock.calls.length).toBeLessThan(5);
        expectNoMaximumUpdateDepthError();
    });

    it('shows a query error without an update-depth error', async () => {
        mockedUseWordThemes.mockReturnValue({
            data: undefined,
            error: { kind: 'infrastructure', message: 'raw SDK diagnostic' },
            isLoading: false,
        } as unknown as ReturnType<typeof useWordThemes>);

        render(<WordAddForm saveFn={jest.fn()} initWord="나비" />);

        await flushReactEffects();
        expect(await screen.findByRole('alert')).toHaveTextContent('주제 정보를 불러오는 중 오류가 발생했습니다.');
        expect(mockedUseWordThemes.mock.calls.length).toBeLessThan(5);
        expectNoMaximumUpdateDepthError();
    });

    it('groups catalog summaries and submits selected theme codes with their Korean labels', async () => {
        const saveFn = jest.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();

        render(
            <WordAddForm
                saveFn={saveFn}
                initWord="나비"
                initThemes={['animal', 'game']}
            />,
        );

        await user.click(screen.getByRole('button', { name: '노인정' }));
        await user.click(screen.getByRole('button', { name: '어인정' }));

        expect(screen.getAllByText('동물').length).toBeGreaterThan(1);
        expect(screen.getAllByText('게임').length).toBeGreaterThan(1);

        await user.click(screen.getAllByRole('button', { name: '단어 저장' }).at(-1)!);

        await waitFor(() => expect(saveFn).toHaveBeenCalledWith('나비', ['animal', 'game']));
    });

    it('shows safe Korean copy for every thrown save failure', async () => {
        const saveFn = jest.fn().mockRejectedValue('raw SDK diagnostic');
        const user = userEvent.setup();

        render(<WordAddForm saveFn={saveFn} initWord="나비" />);

        await user.click(screen.getAllByRole('button', { name: '단어 저장' }).at(-1)!);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('단어 저장 중 오류가 발생했습니다.');
        expect(alert).not.toHaveTextContent('raw SDK diagnostic');
    });
});
