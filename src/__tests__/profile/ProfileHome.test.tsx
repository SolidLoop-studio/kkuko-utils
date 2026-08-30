import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../modules/identity', () => ({ useProfileSearch: jest.fn() }));

import ProfileHomePage from '@/src/app/profile/ProfileHome';
import { useProfileSearch } from '../../modules/identity';
import { err, ok } from '@/src/shared/application/result';

const profiles = [{
    id: 'user-1',
    nickname: '테스터',
    role: 'r2' as const,
    totalContribution: 1234,
    monthlyContribution: 56,
}];

const mockProfileSearch = (search: jest.Mock, isPending = false) => {
    jest.mocked(useProfileSearch).mockReturnValue({ search, isPending });
};

describe('ProfileHomePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the same profile search handler for clicking and Enter', async () => {
        // Break caught: keeping a separate keyboard path that bypasses the explicit-submit hook.
        const user = userEvent.setup();
        const search = jest.fn().mockResolvedValue(ok(profiles));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        const input = screen.getByPlaceholderText('닉네임으로 검색...');
        await user.type(input, '첫검색');
        await user.click(screen.getByRole('button', { name: '검색' }));
        await waitFor(() => expect(search).toHaveBeenCalledWith('첫검색'));

        await user.type(input, '둘째검색');
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(search).toHaveBeenLastCalledWith('둘째검색'));
        expect(search).toHaveBeenCalledTimes(2);
    });

    test('renders public profile projections and clears input after a successful search', async () => {
        // Break caught: leaking database-shaped contribution fields or retaining successful input.
        const user = userEvent.setup();
        const search = jest.fn().mockResolvedValue(ok(profiles));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        const input = screen.getByPlaceholderText('닉네임으로 검색...');
        await user.type(input, '테스터');
        await user.click(screen.getByRole('button', { name: '검색' }));

        expect(await screen.findByText('테스터')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.getByText('56')).toBeInTheDocument();
        expect(screen.getByText('일반')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '프로필 보기' })).toHaveAttribute(
            'href',
            '/profile/테스터',
        );
        expect(input).toHaveValue('');
    });

    test('keeps the existing empty state for a successful no-match search', async () => {
        // Break caught: treating no matches as an error instead of the visible empty state.
        const user = userEvent.setup();
        const search = jest.fn().mockResolvedValue(ok([]));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        await user.type(screen.getByPlaceholderText('닉네임으로 검색...'), '없는사용자');
        await user.click(screen.getByRole('button', { name: '검색' }));

        expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument();
    });

    test('clears prior results and shows only the stable error message after a failed search', async () => {
        // Break caught: retaining stale profiles or exposing raw gateway details after failure.
        const user = userEvent.setup();
        const search = jest.fn()
            .mockResolvedValueOnce(ok(profiles))
            .mockResolvedValueOnce(err({
                kind: 'validation' as const,
                field: 'nickname',
                message: '검색할 닉네임을 입력해주세요.',
            }));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        const input = screen.getByPlaceholderText('닉네임으로 검색...');
        await user.type(input, '테스터');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('테스터')).toBeInTheDocument();

        await user.type(input, '   ');
        await user.click(screen.getByRole('button', { name: '검색' }));

        expect(await screen.findByText('검색할 닉네임을 입력해주세요.')).toBeInTheDocument();
        expect(screen.queryByText('테스터')).not.toBeInTheDocument();
        expect(input).toHaveValue('   ');
        expect(screen.queryByText('private database details')).not.toBeInTheDocument();
    });

    test('clears prior results and retains input for a stable infrastructure error', async () => {
        // Break caught: retaining stale profiles or clearing retry input after an infrastructure failure.
        const user = userEvent.setup();
        const search = jest.fn()
            .mockResolvedValueOnce(ok(profiles))
            .mockResolvedValueOnce(err({
                kind: 'infrastructure' as const,
                message: '사용자 검색 중 오류가 발생했습니다.',
            }));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        const input = screen.getByPlaceholderText('닉네임으로 검색...');
        await user.type(input, '테스터');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(await screen.findByText('테스터')).toBeInTheDocument();

        await user.type(input, '재검색');
        await user.click(screen.getByRole('button', { name: '검색' }));

        expect(await screen.findByText('사용자 검색 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('검색할 닉네임을 입력해주세요.')).not.toBeInTheDocument();
        expect(screen.queryByText('테스터')).not.toBeInTheDocument();
        expect(input).toHaveValue('재검색');
    });

    test('follows pending state for the loading overlay and search button', () => {
        // Break caught: allowing duplicate submissions while the explicit search is pending.
        const search = jest.fn();
        mockProfileSearch(search, true);
        render(<ProfileHomePage />);

        expect(screen.getByText('검색 중입니다...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
    });

    test('renders the guest role without an undefined badge variant', async () => {
        // Break caught: a nullable database role reaching presentation without a supported guest label.
        const user = userEvent.setup();
        const search = jest.fn().mockResolvedValue(ok([{
            ...profiles[0],
            role: 'guest' as const,
        }]));
        mockProfileSearch(search);
        render(<ProfileHomePage />);

        await user.type(screen.getByPlaceholderText('닉네임으로 검색...'), '테스터');
        await user.click(screen.getByRole('button', { name: '검색' }));

        expect(await screen.findByText('게스트')).toBeInTheDocument();
    });
});
