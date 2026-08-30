import type { Result } from '@/src/shared/application/result';
import type {
    CrawlerHealthResponse,
    CreateItemRequest,
    Item,
    ItemsResponse,
    RestartCrawlerResponse,
    SaveSessionRequest,
    SaveSessionResponse,
    UpdateItemRequest,
    User,
    UsersResponse,
} from './admin-api-server-types';

export interface AdminApiServerGateway {
    fetchCrawlerHealth(): Promise<Result<CrawlerHealthResponse>>;
    saveCrawlerSession(data: SaveSessionRequest): Promise<Result<SaveSessionResponse>>;
    restartCrawler(channelId: string): Promise<Result<RestartCrawlerResponse>>;
    fetchItems(page: number): Promise<Result<ItemsResponse>>;
    createItem(data: CreateItemRequest): Promise<Result<Item>>;
    updateItem(id: string, data: UpdateItemRequest): Promise<Result<Item>>;
    deleteItem(id: string): Promise<Result<void>>;
    searchItems(name: string, page: number): Promise<Result<ItemsResponse>>;
    searchItemsByGroup(group: string, page: number): Promise<Result<ItemsResponse>>;
    fetchUsers(page: number): Promise<Result<UsersResponse>>;
    fetchUserById(id: string): Promise<Result<UsersResponse>>;
    searchUsersByNickname(nickname: string): Promise<Result<UsersResponse>>;
    updateUserPublicStatus(id: string, isPublic: boolean): Promise<Result<User>>;
    updateUserLastOnlineHiddenStatus(id: string, isLastOnlineHidden: boolean): Promise<Result<User>>;
    fetchApiServerLogs(date?: string): Promise<Result<string>>;
    fetchCrawlerLogs(date?: string): Promise<Result<string>>;
}
