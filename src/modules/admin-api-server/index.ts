import { createBrowserAdminApiServerServices } from './infrastructure/browser/browser-admin-api-server-services';

const adminApiServerService = createBrowserAdminApiServerServices().adminApiServerService;

export const fetchCrawlerHealth = () => adminApiServerService.fetchCrawlerHealth();
export const saveCrawlerSession = (data: import('./application/admin-api-server-types').SaveSessionRequest) => adminApiServerService.saveCrawlerSession(data);
export const restartCrawler = (channelId: string) => adminApiServerService.restartCrawler(channelId);
export const fetchItems = (page = 1) => adminApiServerService.fetchItems(page);
export const createItem = (data: import('./application/admin-api-server-types').CreateItemRequest) => adminApiServerService.createItem(data);
export const updateItem = (id: string, data: import('./application/admin-api-server-types').UpdateItemRequest) => adminApiServerService.updateItem(id, data);
export const deleteItem = (id: string) => adminApiServerService.deleteItem(id);
export const searchItems = (name: string, page = 1) => adminApiServerService.searchItems(name, page);
export const searchItemsByGroup = (group: string, page = 1) => adminApiServerService.searchItemsByGroup(group, page);
export const fetchUsers = (page = 1) => adminApiServerService.fetchUsers(page);
export const fetchUserById = (id: string) => adminApiServerService.fetchUserById(id);
export const searchUsersByNickname = (nickname: string) => adminApiServerService.searchUsersByNickname(nickname);
export const updateUserPublicStatus = (id: string, isPublic: boolean) => adminApiServerService.updateUserPublicStatus(id, isPublic);
export const updateUserLastOnlineHiddenStatus = (id: string, isLastOnlineHidden: boolean) => adminApiServerService.updateUserLastOnlineHiddenStatus(id, isLastOnlineHidden);
export const fetchApiServerLogs = (date?: string) => adminApiServerService.fetchApiServerLogs(date);
export const fetchCrawlerLogs = (date?: string) => adminApiServerService.fetchCrawlerLogs(date);

export type {
    ChannelHealth,
    CrawlerHealthResponse,
    CreateItemRequest,
    Item,
    ItemOption,
    ItemsResponse,
    RestartCrawlerResponse,
    SaveSessionRequest,
    SaveSessionResponse,
    UpdateItemRequest,
    User,
    UsersResponse,
} from './application/admin-api-server-types';
