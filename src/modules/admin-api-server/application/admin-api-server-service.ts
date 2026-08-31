import type { Result } from '@/src/shared/application/result';
import type { AdminApiServerGateway } from './admin-api-server-ports';
import {
    isAppErrorLogIds,
    isAppErrorLogs,
    isCrawlerHealthResponse,
    isCreateItemRequest,
    isDeleteAppErrorLogsResponse,
    isItem,
    isItemsResponse,
    isNonBlankString,
    isPositiveSafePage,
    isRestartCrawlerResponse,
    isSaveSessionRequest,
    isSaveSessionResponse,
    isUpdateItemRequest,
    isUser,
    isUsersResponse,
    isValidLogDate,
    type AppErrorLog,
    type CrawlerHealthResponse,
    type CreateItemRequest,
    type DeleteAppErrorLogsResponse,
    type Item,
    type ItemsResponse,
    type RestartCrawlerResponse,
    type SaveSessionRequest,
    type SaveSessionResponse,
    type UpdateItemRequest,
    type User,
    type UsersResponse,
} from './admin-api-server-types';

const validationMessage = '올바른 요청 값이 필요합니다.';
const unauthorizedMessage = '관리자 인증이 필요합니다.';

const isResult = <T>(value: unknown): value is Result<T> => (
    typeof value === 'object' && value !== null && 'ok' in value && typeof value.ok === 'boolean'
);

/** 관리자 외부 API의 입력과 안정적인 공개 오류를 Application 경계에서 보장합니다. */
export class AdminApiServerService {
    constructor(private readonly gateway: AdminApiServerGateway) {}

    private async execute<T>(request: Promise<Result<T>>, isValid: (value: unknown) => value is T, message: string): Promise<T> {
        try {
            const result = await request;
            if (!isResult<T>(result)) throw new Error(message);
            if (!result.ok) {
                throw new Error(result.error.kind === 'unauthorized' ? unauthorizedMessage : message);
            }
            if (!isValid(result.value)) throw new Error(message);
            return result.value;
        } catch (error) {
            if (error instanceof Error && (error.message === message || error.message === unauthorizedMessage)) throw error;
            throw new Error(message);
        }
    }

    private invalid<T>(): Promise<T> { return Promise.reject(new Error(validationMessage)); }

    fetchCrawlerHealth(): Promise<CrawlerHealthResponse> {
        return this.execute(this.gateway.fetchCrawlerHealth(), isCrawlerHealthResponse, '크롤러 상태를 불러오는데 실패했습니다.');
    }
    saveCrawlerSession(data: SaveSessionRequest): Promise<SaveSessionResponse> {
        if (!isSaveSessionRequest(data)) return this.invalid();
        return this.execute(this.gateway.saveCrawlerSession(data), isSaveSessionResponse, '세션 저장에 실패했습니다.');
    }
    restartCrawler(channelId: string): Promise<RestartCrawlerResponse> {
        if (!isNonBlankString(channelId)) return this.invalid();
        return this.execute(this.gateway.restartCrawler(channelId), isRestartCrawlerResponse, '재시작 요청에 실패했습니다.');
    }
    fetchItems(page = 1): Promise<ItemsResponse> {
        if (!isPositiveSafePage(page)) return this.invalid();
        return this.execute(this.gateway.fetchItems(page), isItemsResponse, '아이템 정보를 불러오는데 실패했습니다.');
    }
    createItem(data: CreateItemRequest): Promise<Item> {
        if (!isCreateItemRequest(data)) return this.invalid();
        return this.execute(this.gateway.createItem(data), isItem, '아이템 저장에 실패했습니다.');
    }
    updateItem(id: string, data: UpdateItemRequest): Promise<Item> {
        if (!isNonBlankString(id) || !isUpdateItemRequest(data)) return this.invalid();
        return this.execute(this.gateway.updateItem(id, data), isItem, '아이템 저장에 실패했습니다.');
    }
    async deleteItem(id: string): Promise<void> {
        if (!isNonBlankString(id)) return this.invalid();
        await this.execute(this.gateway.deleteItem(id), (value): value is undefined => value === undefined, '아이템 삭제에 실패했습니다.');
    }
    searchItems(name: string, page = 1): Promise<ItemsResponse> {
        if (!isNonBlankString(name) || !isPositiveSafePage(page)) return this.invalid();
        return this.execute(this.gateway.searchItems(name, page), isItemsResponse, '아이템 정보를 불러오는데 실패했습니다.');
    }
    searchItemsByGroup(group: string, page = 1): Promise<ItemsResponse> {
        if (!isNonBlankString(group) || !isPositiveSafePage(page)) return this.invalid();
        return this.execute(this.gateway.searchItemsByGroup(group, page), isItemsResponse, '아이템 정보를 불러오는데 실패했습니다.');
    }
    fetchUsers(page = 1): Promise<UsersResponse> {
        if (!isPositiveSafePage(page)) return this.invalid();
        return this.execute(this.gateway.fetchUsers(page), isUsersResponse, '사용자 정보를 불러오는데 실패했습니다.');
    }
    fetchUserById(id: string): Promise<UsersResponse> {
        if (!isNonBlankString(id)) return this.invalid();
        return this.execute(this.gateway.fetchUserById(id), isUsersResponse, '사용자 정보를 불러오는데 실패했습니다.');
    }
    searchUsersByNickname(nickname: string): Promise<UsersResponse> {
        if (!isNonBlankString(nickname)) return this.invalid();
        return this.execute(this.gateway.searchUsersByNickname(nickname), isUsersResponse, '사용자 정보를 불러오는데 실패했습니다.');
    }
    updateUserPublicStatus(id: string, isPublic: boolean): Promise<User> {
        if (!isNonBlankString(id) || typeof isPublic !== 'boolean') return this.invalid();
        return this.execute(this.gateway.updateUserPublicStatus(id, isPublic), isUser, '사용자 정보 저장에 실패했습니다.');
    }
    updateUserLastOnlineHiddenStatus(id: string, isLastOnlineHidden: boolean): Promise<User> {
        if (!isNonBlankString(id) || typeof isLastOnlineHidden !== 'boolean') return this.invalid();
        return this.execute(this.gateway.updateUserLastOnlineHiddenStatus(id, isLastOnlineHidden), isUser, '사용자 정보 저장에 실패했습니다.');
    }
    fetchApiServerLogs(date?: string): Promise<string> {
        if (date !== undefined && !isValidLogDate(date)) return this.invalid();
        return this.execute(this.gateway.fetchApiServerLogs(date), (value): value is string => typeof value === 'string', '로그를 불러오는데 실패했습니다.');
    }
    fetchCrawlerLogs(date?: string): Promise<string> {
        if (date !== undefined && !isValidLogDate(date)) return this.invalid();
        return this.execute(this.gateway.fetchCrawlerLogs(date), (value): value is string => typeof value === 'string', '로그를 불러오는데 실패했습니다.');
    }
    fetchAppErrorLogs(limit?: number): Promise<AppErrorLog[]> {
        if (limit !== undefined && !isPositiveSafePage(limit)) return this.invalid();
        return this.execute(this.gateway.fetchAppErrorLogs(limit), isAppErrorLogs, '애플리케이션 로그를 불러오는데 실패했습니다.');
    }
    deleteAppErrorLogs(ids: string[]): Promise<DeleteAppErrorLogsResponse> {
        if (!isAppErrorLogIds(ids)) return this.invalid();
        return this.execute(this.gateway.deleteAppErrorLogs(ids), isDeleteAppErrorLogsResponse, '애플리케이션 로그 삭제에 실패했습니다.');
    }
}
