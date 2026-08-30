import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSWR from 'swr';

import WordAddForm from '../../../app/word/components/WordAddFrom';
import { useWordThemes } from '../../../modules/word-catalog';

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../modules/word-catalog', () => ({ useWordThemes: jest.fn() }));
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

const themes = [
    { id: 1, code: 'animal', name: '동물' },
    { id: 2, code: 'game', name: '게임' },
];

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSWR).mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
    } as ReturnType<typeof useSWR>);
    jest.mocked(useWordThemes).mockReturnValue({
        data: themes,
        error: undefined,
        isLoading: false,
    } as unknown as ReturnType<typeof useWordThemes>);
});

describe('WordAddForm theme loading', () => {
    it('disables saving while the catalog themes are loading', () => {
        jest.mocked(useWordThemes).mockReturnValue({
            data: undefined,
            error: undefined,
            isLoading: true,
        } as unknown as ReturnType<typeof useWordThemes>);

        render(<WordAddForm saveFn={jest.fn()} initWord="나비" />);

        expect(screen.getAllByRole('button', { name: '단어 저장' }).at(-1)).toBeDisabled();
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
