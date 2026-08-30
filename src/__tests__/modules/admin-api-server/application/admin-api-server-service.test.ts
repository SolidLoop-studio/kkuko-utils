import { AdminApiServerService } from '@/src/modules/admin-api-server/application/admin-api-server-service';
import type { AdminApiServerGateway } from '@/src/modules/admin-api-server/application/admin-api-server-ports';
import type { Item, ItemsResponse, User, UsersResponse } from '@/src/modules/admin-api-server/application/admin-api-server-types';
import { err, ok } from '@/src/shared/application/result';

const item: Item = { id: 'item-1', name: '아이템', description: '', updatedAt: 1, group: 'normal', options: { gEXP: 2 } };
const items: ItemsResponse = { items: [item], totalCount: 1, currentPage: 1, totalPages: 1 };
const user: User = { id: 'user-1', nickname: '끝말잇기', exp: 1, observedAt: '2026-01-01', exordial: 'x', level: 1, isPublic: true, isLastOnlineHidden: false };
const users: UsersResponse = { items: [user], totalCount: 1, currentPage: 1, totalPages: 1 };

const createGateway = (): jest.Mocked<AdminApiServerGateway> => ({
    fetchCrawlerHealth: jest.fn().mockResolvedValue(ok({ channels: [{ id: 'channel-1', healthy: true }] })),
    saveCrawlerSession: jest.fn().mockResolvedValue(ok({ message: 'saved' })),
    restartCrawler: jest.fn().mockResolvedValue(ok({ status: 'queued', channel: 'channel-1' })),
    fetchItems: jest.fn().mockResolvedValue(ok(items)),
    createItem: jest.fn().mockResolvedValue(ok(item)),
    updateItem: jest.fn().mockResolvedValue(ok(item)),
    deleteItem: jest.fn().mockResolvedValue(ok(undefined)),
    searchItems: jest.fn().mockResolvedValue(ok(items)),
    searchItemsByGroup: jest.fn().mockResolvedValue(ok(items)),
    fetchUsers: jest.fn().mockResolvedValue(ok(users)),
    fetchUserById: jest.fn().mockResolvedValue(ok(users)),
    searchUsersByNickname: jest.fn().mockResolvedValue(ok(users)),
    updateUserPublicStatus: jest.fn().mockResolvedValue(ok(user)),
    updateUserLastOnlineHiddenStatus: jest.fn().mockResolvedValue(ok(user)),
    fetchApiServerLogs: jest.fn().mockResolvedValue(ok('api logs')),
    fetchCrawlerLogs: jest.fn().mockResolvedValue(ok('crawler logs')),
});

describe('AdminApiServerService', () => {
    test('delegates all validated operations without an access-token parameter', async () => {
        // Break caught: changing a screen-visible request payload, sequence, or API operation during boundary extraction.
        const gateway = createGateway();
        const service = new AdminApiServerService(gateway);

        await expect(service.fetchCrawlerHealth()).resolves.toEqual({ channels: [{ id: 'channel-1', healthy: true }] });
        await expect(service.saveCrawlerSession({ channelId: 'channel-1', jwtToken: 'jwt', refreshToken: 'refresh' })).resolves.toEqual({ message: 'saved' });
        await expect(service.restartCrawler('channel-1')).resolves.toEqual({ status: 'queued', channel: 'channel-1' });
        await expect(service.fetchItems(1)).resolves.toEqual(items);
        await expect(service.createItem({ id: 'item-1', name: '아이템', description: '', group: 'normal', options: { gEXP: 2 } })).resolves.toEqual(item);
        await expect(service.updateItem('item-1', { name: '변경' })).resolves.toEqual(item);
        await expect(service.deleteItem('item-1')).resolves.toBeUndefined();
        await expect(service.searchItems('아이템', 1)).resolves.toEqual(items);
        await expect(service.searchItemsByGroup('normal', 1)).resolves.toEqual(items);
        await expect(service.fetchUsers(1)).resolves.toEqual(users);
        await expect(service.fetchUserById('user-1')).resolves.toEqual(users);
        await expect(service.searchUsersByNickname('끝말잇기')).resolves.toEqual(users);
        await expect(service.updateUserPublicStatus('user-1', true)).resolves.toEqual(user);
        await expect(service.updateUserLastOnlineHiddenStatus('user-1', false)).resolves.toEqual(user);
        await expect(service.fetchApiServerLogs('2026-01-01')).resolves.toBe('api logs');
        await expect(service.fetchCrawlerLogs()).resolves.toBe('crawler logs');

        expect(gateway.restartCrawler).toHaveBeenCalledWith('channel-1');
        expect(gateway.updateItem).toHaveBeenCalledWith('item-1', { name: '변경' });
        expect(gateway.fetchCrawlerLogs).toHaveBeenCalledWith(undefined);
    });

    test.each([
        ['page', () => new AdminApiServerService(createGateway()).fetchItems(0)],
        ['identifier', () => new AdminApiServerService(createGateway()).deleteItem('  ')],
        ['search text', () => new AdminApiServerService(createGateway()).searchItems('\t', 1)],
        ['date', () => new AdminApiServerService(createGateway()).fetchApiServerLogs('not-a-date')],
        ['item option number', () => new AdminApiServerService(createGateway()).createItem({ id: 'item', name: 'name', description: '', group: 'group', options: { gEXP: Number.NaN } })],
    ])('rejects an invalid %s before Infrastructure is called', async (_name, operation) => {
        // Break caught: constructing a malformed URL or payload from untrusted presentation input.
        await expect(operation()).rejects.toThrow('올바른 요청 값이 필요합니다.');
    });

    test.each([
        ['a returned gateway diagnostic', err({ kind: 'infrastructure' as const, message: 'private upstream detail' })],
        ['a malformed returned gateway value', ok(null as never)],
    ])('maps %s to a stable public operation error', async (_name, result) => {
        // Break caught: exposing upstream error bodies or malformed data to React Query consumers.
        const gateway = createGateway();
        gateway.fetchItems.mockResolvedValue(result as never);

        await expect(new AdminApiServerService(gateway).fetchItems()).rejects.toThrow('아이템 정보를 불러오는데 실패했습니다.');
    });

    test('maps a thrown gateway diagnostic to the same stable public operation error', async () => {
        // Break caught: allowing a rejected transport promise to bypass Application error mapping.
        const gateway = createGateway();
        gateway.fetchUsers.mockRejectedValue(new Error('private transport detail'));

        await expect(new AdminApiServerService(gateway).fetchUsers()).rejects.toThrow('사용자 정보를 불러오는데 실패했습니다.');
    });
});
