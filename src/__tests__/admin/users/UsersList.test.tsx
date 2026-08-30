import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/badge');

const push = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}));

jest.mock('../../../modules/admin-users', () => ({
    useAdminUserList: jest.fn(),
}));

import type { AdminUserListItem, AdminUserListSort } from '@/src/modules/admin-users';
import { useAdminUserList } from '@/src/modules/admin-users';
import UsersList from '../../../app/admin/users/UsersList';

const users: AdminUserListItem[] = [
    { id: 'user-1', nickname: '관리자', role: 'admin', contribution: 1200, monthContribution: 34 },
    { id: 'user-2', nickname: '새싹', role: 'r1', contribution: 40, monthContribution: 5 },
    { id: 'user-3', nickname: '손님', role: 'guest', contribution: 10, monthContribution: 0 },
];

const mockUseAdminUserList = jest.mocked(useAdminUserList);

const mockSuccessfulQuery = () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockUseAdminUserList.mockReturnValue({
        data: users,
        error: null,
        isLoading: false,
        refetch,
    } as unknown as ReturnType<typeof useAdminUserList>);
    return refetch;
};

const lastSort = (): AdminUserListSort => (
    mockUseAdminUserList.mock.calls[mockUseAdminUserList.mock.calls.length - 1][0]
);

describe('UsersList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSuccessfulQuery();
    });

    test('keeps legacy data access and generated database row types out of the screen source', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/admin/users/UsersList.tsx'),
            'utf8',
        );
        const forbiddenReadCoupling = [
            /\bSCM\b/,
            /\bsupabaseClient\b/,
            /@supabase/,
            /database\.types/,
            /Tables\s*</,
            /\.from\s*\(/,
            /\.rpc\s*\(/,
        ];

        for (const forbidden of forbiddenReadCoupling) {
            expect(source).not.toMatch(forbidden);
        }
    });

    test('starts contribution-descending, toggles a same column, and resets a new column to descending', async () => {
        // Break caught: changing the established sort behavior while moving it into the query hook.
        const user = userEvent.setup();
        render(<UsersList />);

        expect(lastSort()).toEqual({ field: 'contribution', direction: 'desc' });
        await user.click(screen.getByRole('button', { name: /총 기여도/ }));
        expect(lastSort()).toEqual({ field: 'contribution', direction: 'asc' });
        await user.click(screen.getByRole('button', { name: /닉네임/ }));
        expect(lastSort()).toEqual({ field: 'nickname', direction: 'desc' });
    });

    test('renders projection-only statistics, role labels, month heading, dashboard link, and profile navigation', async () => {
        // Break caught: deriving the dashboard from hidden database columns or losing its user navigation affordances.
        const user = userEvent.setup();
        render(<UsersList />);

        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('1,250')).toBeInTheDocument();
        expect(screen.getAllByText('관리자')).toHaveLength(2);
        expect(screen.getAllByText('새싹')).toHaveLength(2);
        expect(screen.getAllByText('일반')).toHaveLength(1);
        expect(screen.getByRole('button', { name: new RegExp(`${new Date().getMonth() + 1}월 기여도`) })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /관리자 대시보드로 이동/ })).toHaveAttribute('href', '/admin');

        await user.click(screen.getByRole('button', { name: '관리자' }));
        expect(push).toHaveBeenCalledWith('/profile/관리자');
    });

    test('renders the established loading and empty states', () => {
        // Break caught: showing stale table content while a user-list query loads or returns no users.
        mockUseAdminUserList.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useAdminUserList>);
        const { rerender } = render(<UsersList />);
        expect(screen.getByText('사용자 목록을 불러오는 중...')).toBeInTheDocument();

        mockUseAdminUserList.mockReturnValue({
            data: [],
            error: null,
            isLoading: false,
            refetch: jest.fn(),
        } as unknown as ReturnType<typeof useAdminUserList>);
        rerender(<UsersList />);
        expect(screen.getByText('등록된 사용자가 없습니다.')).toBeInTheDocument();
    });

    test('shows only stable ErrorModal copy, closes without an automatic retry loop, and retries accessibly', async () => {
        // Break caught: exposing a gateway diagnostic, reopening a dismissed query error, or wiring retry to anything except refetch.
        const user = userEvent.setup();
        const refetch = jest.fn().mockResolvedValue(undefined);
        mockUseAdminUserList.mockReturnValue({
            data: undefined,
            error: { kind: 'infrastructure', message: 'private PostgREST diagnostic' },
            isLoading: false,
            refetch,
        } as unknown as ReturnType<typeof useAdminUserList>);
        render(<UsersList />);

        expect(screen.getByText('사용자 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('private PostgREST diagnostic')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByText('사용자 목록을 불러오는 중 오류가 발생했습니다.')).not.toBeInTheDocument();
        expect(refetch).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: '사용자 목록 다시 시도' }));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    });
});
