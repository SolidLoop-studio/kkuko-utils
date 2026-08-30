import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: jest.fn(() => false), configurable: true },
    setPointerCapture: { value: jest.fn(), configurable: true },
    releasePointerCapture: { value: jest.fn(), configurable: true },
    scrollIntoView: { value: jest.fn(), configurable: true },
});

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('react-loading-skeleton', () => ({ __esModule: true, default: () => <span data-testid="skeleton" /> }));
jest.mock('../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: { ErrName: string; ErrMessage: string; ErrStackRace?: string } }) => (
        <div role="alert">{error.ErrName}|{error.ErrMessage}|{error.ErrStackRace ?? ''}</div>
    ),
}));
jest.mock('../../../modules/word-requests', () => ({ usePublicWordRequestPage: jest.fn() }));

import { useRouter } from 'next/navigation';
import RequestsHome from '../../../app/word/requests/RequestsHome';
import type { PublicWordRequestPageProjection } from '../../../modules/word-requests';
import { usePublicWordRequestPage } from '../../../modules/word-requests';

const push = jest.fn();
const mockedUsePublicWordRequestPage = jest.mocked(usePublicWordRequestPage);

const page = (
    overrides: Partial<PublicWordRequestPageProjection> = {},
): PublicWordRequestPageProjection => ({
    page: 1,
    pageSize: 30,
    totalCount: 1,
    items: [{
        id: 1,
        requestType: 'add',
        requestedAt: '2026-08-30T00:00:00.000Z',
        requestedBy: 'user-1',
        status: 'pending',
        word: '나비',
        wordId: null,
        requesterNickname: '요청자',
    }],
    ...overrides,
});

const queryState = (overrides: Record<string, unknown> = {}) => ({
    data: page(),
    error: null,
    isLoading: false,
    ...overrides,
}) as ReturnType<typeof usePublicWordRequestPage>;

describe('RequestsHome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useSelector).mockImplementation((selector) => selector({ user: { uuid: 'user-1' } } as never));
        jest.mocked(useRouter).mockReturnValue({ push } as never);
        mockedUsePublicWordRequestPage.mockReturnValue(queryState());
    });

    test('renders thirty loading skeleton rows while the public page query is loading', () => {
        // Break caught: request page loading loses its stable table height and shifts the screen.
        mockedUsePublicWordRequestPage.mockReturnValue(queryState({ data: undefined, isLoading: true }));

        render(<RequestsHome />);

        expect(screen.getAllByTestId('skeleton')).toHaveLength(180);
    });

    test('shows only stable Korean error copy when the public page query fails', async () => {
        // Break caught: a backend diagnostic reaches the public error modal.
        mockedUsePublicWordRequestPage.mockReturnValue(queryState({
            data: undefined,
            error: { kind: 'infrastructure', message: 'raw SDK diagnostic' },
        }));

        render(<RequestsHome />);

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'ApplicationError|단어 요청 목록을 불러오는 중 오류가 발생했습니다.|',
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent('raw SDK diagnostic');
    });

    test('renders an empty page as 0 / 0 and disables both pagination boundaries', () => {
        // Break caught: empty query results create an invalid page number or usable pagination controls.
        mockedUsePublicWordRequestPage.mockReturnValue(queryState({ data: page({ totalCount: 0, items: [] }) }));

        render(<RequestsHome />);

        expect(screen.getByText('0 / 0 페이지')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    });

    test('resets page to one when the selected status changes', async () => {
        // Break caught: switching a status retains a later page that may not exist in the new result set.
        const user = userEvent.setup();
        mockedUsePublicWordRequestPage.mockImplementation(({ page: requestedPage, status }) => queryState({
            data: page({ page: requestedPage, totalCount: 31, items: [] }),
        }));

        render(<RequestsHome />);
        await user.click(screen.getByRole('button', { name: '다음' }));
        await user.click(screen.getByRole('combobox'));
        await user.click(screen.getByRole('option', { name: '대기중' }));

        await waitFor(() => expect(mockedUsePublicWordRequestPage).toHaveBeenLastCalledWith({
            page: 1,
            status: 'pending',
        }));
    });

    test('clamps an out-of-range returned page once without a requery loop', async () => {
        // Break caught: an exact count shrink leaves the screen on an invalid page or causes repeated requests.
        const user = userEvent.setup();
        mockedUsePublicWordRequestPage.mockImplementation(({ page: requestedPage, status }) => queryState({
            data: page({
                page: requestedPage,
                totalCount: requestedPage === 2 ? 1 : 31,
                items: [],
            }),
        }));

        render(<RequestsHome />);
        await user.click(screen.getByRole('button', { name: '다음' }));

        await waitFor(() => expect(mockedUsePublicWordRequestPage).toHaveBeenLastCalledWith({
            page: 1,
            status: 'all',
        }));
        expect(mockedUsePublicWordRequestPage.mock.calls.length).toBe(3);
    });

    test('highlights the current user row and preserves word and requester navigation', async () => {
        // Break caught: projection changes remove own-request affordance or break navigation targets.
        const user = userEvent.setup();

        render(<RequestsHome />);
        expect(screen.getByText('나비').closest('tr')).toHaveClass('bg-blue-50');

        await user.click(screen.getByText('나비'));
        await user.click(screen.getByRole('cell', { name: '요청자' }));
        expect(push).toHaveBeenNthCalledWith(1, '/word/search/나비');
        expect(push).toHaveBeenNthCalledWith(2, '/profile/요청자');
    });

    test('keeps query infrastructure out of the screen source boundary', () => {
        // Break caught: the screen bypasses the feature hook and reintroduces database/query dependencies.
        const source = readFileSync('src/app/word/requests/RequestsHome.tsx', 'utf8');

        for (const forbidden of ['SCM', 'supabaseClient', '@supabase', 'database.types', '.from(', '.rpc(']) {
            expect(source).not.toContain(forbidden);
        }
    });
});
