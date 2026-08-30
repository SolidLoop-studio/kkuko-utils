import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
jest.mock('../../../modules/admin-api-server', () => ({
    fetchCrawlerHealth: jest.fn(), saveCrawlerSession: jest.fn(), restartCrawler: jest.fn(),
    fetchItems: jest.fn(), createItem: jest.fn(), updateItem: jest.fn(), deleteItem: jest.fn(), searchItems: jest.fn(), searchItemsByGroup: jest.fn(),
    fetchUsers: jest.fn(), fetchUserById: jest.fn(), searchUsersByNickname: jest.fn(),
    updateUserPublicStatus: jest.fn(), updateUserLastOnlineHiddenStatus: jest.fn(),
    fetchApiServerLogs: jest.fn(), fetchCrawlerLogs: jest.fn(),
}));
jest.mock('../../../app/components/ConfirmModal', () => ({
    __esModule: true,
    default: ({ onConfirm }: { onConfirm: () => void }) => <button onClick={onConfirm}>confirm</button>,
}));
jest.mock('../../../app/components/CompleteModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/components/FailModal', () => ({
    __esModule: true,
    default: ({ open, description }: { open: boolean; description: string }) => open ? <div role="alert">{description}</div> : null,
}));
jest.mock('../../../app/admin/api-server/items/_components/ItemsTable', () => ({
    __esModule: true,
    default: ({ items }: { items: Array<{ name: string }> }) => <div>{items.map((item) => <span key={item.name}>{item.name}</span>)}</div>,
}));
jest.mock('../../../app/admin/api-server/items/_components/EditItemModal', () => ({
    __esModule: true,
    default: ({ onSave }: { onSave: (item: { id: string; name: string; description: string; group: string; options: Record<string, number> }) => void }) => (
        <button onClick={() => onSave({ id: 'item-1', name: '아이템', description: '', group: 'normal', options: {} })}>save item</button>
    ),
}));
jest.mock('../../../app/admin/api-server/users/_components/UsersTable', () => ({
    __esModule: true,
    default: ({ items, onEdit }: { items: Array<{ nickname: string; id: string; isPublic: boolean; isLastOnlineHidden: boolean }>; onEdit: (user: { nickname: string; id: string; isPublic: boolean; isLastOnlineHidden: boolean }) => void }) => (
        <div>{items.map((item) => <button key={item.id} onClick={() => onEdit(item)}>{item.nickname}</button>)}</div>
    ),
}));
jest.mock('../../../app/admin/api-server/users/_components/EditUserModal', () => ({
    __esModule: true,
    default: ({ onSave }: { onSave: (input: { isPublic: boolean; isLastOnlineHidden: boolean }) => void }) => <button onClick={() => onSave({ isPublic: false, isLastOnlineHidden: true })}>save user</button>,
}));
jest.mock('../../../app/admin/api-server/logs/components/StatisticsCards', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/admin/api-server/logs/components/LogCharts', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/admin/api-server/logs/components/LogsTable', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/admin/api-server/logs/components/LogDetailModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../app/admin/api-server/logs/utils/pinoLogParser', () => ({
    parsePinoLogs: () => [{ level: 30 }],
    calculateLogStatistics: () => ({}),
}));

import CrawlerManager from '../../../app/admin/api-server/crawler/CrawlerManager';
import ItemsManageHome from '../../../app/admin/api-server/items/ItemsMangeHome';
import LogsViewer from '../../../app/admin/api-server/logs/LogsViewer';
import UsersManageHome from '../../../app/admin/api-server/users/UsersManageHome';
import * as featureServices from '../../../modules/admin-api-server';

const mockApi = jest.mocked(featureServices);

const renderWithQuery = (ui: React.ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const itemPage = { items: [{ id: 'item-1', name: '아이템', description: '', updatedAt: 1, group: 'normal', options: {} }], totalCount: 1, currentPage: 1, totalPages: 1 };
const userPage = { items: [{ id: 'user-1', nickname: '사용자', exp: 1, observedAt: '2026-01-01', exordial: '', level: 1, isPublic: true, isLastOnlineHidden: false }], totalCount: 1, currentPage: 1, totalPages: 1 };

describe('admin API-server consumers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.values(mockApi)
            .filter(jest.isMockFunction)
            .forEach((fn) => fn.mockResolvedValue(undefined));
    });

    test('Items preserves create sequencing and invalidates its existing items query after success', async () => {
        // Break caught: replacing the feature call or losing the post-create list refresh during the gateway migration.
        const user = userEvent.setup();
        mockApi.fetchItems.mockResolvedValue(itemPage);
        mockApi.createItem.mockResolvedValue(itemPage.items[0]);
        renderWithQuery(<ItemsManageHome />);

        expect(await screen.findByText('아이템')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'save item' }));
        await waitFor(() => expect(mockApi.createItem).toHaveBeenCalledWith({ id: 'item-1', name: '아이템', description: '', group: 'normal', options: {} }));
        await waitFor(() => expect(mockApi.fetchItems).toHaveBeenCalledTimes(2));
    });

    test('Items shows only a stable public error when its query rejects unexpectedly', async () => {
        // Break caught: allowing an unexpected gateway diagnostic to reach the error modal.
        mockApi.fetchItems.mockRejectedValue(new Error('private upstream body'));
        renderWithQuery(<ItemsManageHome />);

        expect(await screen.findByRole('alert')).toHaveTextContent('아이템 정보를 불러오는데 실패했습니다.');
        expect(screen.getByRole('alert')).not.toHaveTextContent('private upstream body');
    });

    test('Users keeps ordered status mutation calls and refreshes its existing users query after success', async () => {
        // Break caught: changing public-status/last-online sequencing or losing the users invalidation.
        const user = userEvent.setup();
        mockApi.fetchUsers.mockResolvedValue(userPage);
        mockApi.updateUserPublicStatus.mockResolvedValue(userPage.items[0]);
        mockApi.updateUserLastOnlineHiddenStatus.mockResolvedValue(userPage.items[0]);
        renderWithQuery(<UsersManageHome />);

        await user.click(await screen.findByRole('button', { name: '사용자' }));
        await user.click(screen.getByRole('button', { name: 'save user' }));
        await waitFor(() => expect(mockApi.updateUserPublicStatus).toHaveBeenCalledWith('user-1', false));
        await waitFor(() => expect(mockApi.updateUserLastOnlineHiddenStatus).toHaveBeenCalledWith('user-1', true));
        expect(mockApi.updateUserPublicStatus.mock.invocationCallOrder[0]).toBeLessThan(mockApi.updateUserLastOnlineHiddenStatus.mock.invocationCallOrder[0]);
        await waitFor(() => expect(mockApi.fetchUsers).toHaveBeenCalledTimes(2));
    });

    test('Users shows only a stable public error when its query rejects unexpectedly', async () => {
        // Break caught: displaying an unexpected backend diagnostic in the user failure modal.
        mockApi.fetchUsers.mockRejectedValue(new Error('private user response'));
        renderWithQuery(<UsersManageHome />);

        expect(await screen.findByRole('alert')).toHaveTextContent('사용자 정보를 불러오는데 실패했습니다.');
        expect(screen.getByRole('alert')).not.toHaveTextContent('private user response');
    });

    test('Crawler continues its confirmed restart flow and refreshes health afterward', async () => {
        // Break caught: losing the confirm → restart → health-refresh behavior during import migration.
        const user = userEvent.setup();
        mockApi.fetchCrawlerHealth.mockResolvedValue({ channels: [{ id: 'channel-1', healthy: true }] });
        mockApi.restartCrawler.mockResolvedValue({ status: 'queued', channel: 'channel-1' });
        render(<CrawlerManager />);

        await user.click(await screen.findByText('channel-1'));
        await user.click(screen.getByRole('button', { name: '크롤러 재시작' }));
        await user.click(screen.getByRole('button', { name: 'confirm' }));
        await waitFor(() => expect(mockApi.restartCrawler).toHaveBeenCalledWith('channel-1'));
        await waitFor(() => expect(mockApi.fetchCrawlerHealth).toHaveBeenCalledTimes(2));
    });

    test('Logs keeps the selected API-server fetch and raw-log view interaction', async () => {
        // Break caught: changing the selected log API or making fetched log text unavailable in the existing raw view.
        const user = userEvent.setup();
        mockApi.fetchApiServerLogs.mockResolvedValue('{"msg":"ready"}');
        render(<LogsViewer />);

        await user.click(screen.getByRole('button', { name: '로그 조회' }));
        await waitFor(() => expect(mockApi.fetchApiServerLogs).toHaveBeenCalledWith(undefined));
        await user.click(screen.getByRole('button', { name: 'Raw Logs' }));
        expect(screen.getByText('{"msg":"ready"}')).toBeInTheDocument();
    });
});
