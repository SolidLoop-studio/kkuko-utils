import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import useSWR from 'swr';

import WordAddHome from '../../../app/word/add/WordAddHome';
import { useUserWordRequests } from '../../../modules/word-requests';
import { err, ok } from '../../../shared/application/result';

const legacyWaitWord = jest.fn();
const legacyWaitWordThemes = jest.fn();
const requestAddition = jest.fn();

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../modules/word-requests', () => ({ useUserWordRequests: jest.fn() }));
jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        add: () => ({
            waitWord: legacyWaitWord,
            waitWordThemes: legacyWaitWordThemes,
        }),
    },
}));
jest.mock('../../../app/word/components/WordAddFrom', () => ({
    __esModule: true,
    default: ({ saveFn }: { saveFn: (word: string, themes: string[]) => Promise<void> }) => (
        <button onClick={() => saveFn('가방', ['animal', 'place'])}>테스트 저장</button>
    ),
}));
jest.mock('../../../app/components/CompleteModal', () => ({
    __esModule: true,
    default: ({ title, description }: { title: string; description: string }) => (
        <div role="dialog"><span>{title}</span><span>{description}</span></div>
    ),
}));
jest.mock('../../../app/components/FailModal', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div role="status">{description}</div>,
}));
jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: ErrorMessage }) => (
        <div role="alert">{error.ErrName}|{error.ErrMessage}|{error.ErrStackRace}</div>
    ),
}));
jest.mock('../../../app/components/LoginRequiredModal', () => ({
    __esModule: true,
    default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSelector).mockImplementation((selector) => selector({
        user: { uuid: 'user-1', role: 'r1' },
    } as never));
    jest.mocked(useSWR).mockReturnValue({
        data: [
            { id: 1, code: 'animal', name: '동물' },
            { id: 2, code: 'place', name: '지명' },
        ],
    } as ReturnType<typeof useSWR>);
    jest.mocked(useUserWordRequests).mockReturnValue({
        requestAddition,
        requestAdditions: jest.fn(),
        requestDeletion: jest.fn(),
        cancel: jest.fn(),
        isPending: false,
        error: null,
        clearError: jest.fn(),
    });
    requestAddition.mockResolvedValue(ok({
        requestId: 10,
        word: '가방',
        requestType: 'add',
        themes: [
            { themeCode: 'animal', themeName: '동물' },
            { themeCode: 'place', themeName: '지명' },
        ],
    }));
});

describe('WordAddHome user addition request', () => {
    it('submits through the feature hook and renders returned theme names', async () => {
        render(<WordAddHome />);

        fireEvent.click(screen.getByRole('button', { name: '테스트 저장' }));

        await waitFor(() => expect(requestAddition).toHaveBeenCalledWith({
            word: '가방',
            themeCodes: ['animal', 'place'],
        }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('동물, 지명');
        expect(legacyWaitWord).not.toHaveBeenCalled();
        expect(legacyWaitWordThemes).not.toHaveBeenCalled();
    });

    it('shows a conflict as a safe failure message', async () => {
        requestAddition.mockResolvedValue(err({
            kind: 'conflict',
            message: '이미 요청이 들어온 단어입니다.',
        }));
        render(<WordAddHome />);

        fireEvent.click(screen.getByRole('button', { name: '테스트 저장' }));

        expect(await screen.findByRole('status')).toHaveTextContent('이미 요청이 들어온 단어입니다.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows stable application error fields', async () => {
        requestAddition.mockResolvedValue(err({
            kind: 'infrastructure',
            message: '데이터 처리 중 오류가 발생했습니다.',
            code: 'P0001',
        }));
        render(<WordAddHome />);

        fireEvent.click(screen.getByRole('button', { name: '테스트 저장' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'ApplicationError:infrastructure|데이터 처리 중 오류가 발생했습니다.|P0001',
        );
    });
});
