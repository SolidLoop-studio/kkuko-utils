import { err, ok, type Result } from '@/src/shared/application/result';
import type { AdminApiServerGateway } from '../../application/admin-api-server-ports';
import {
    isCrawlerHealthResponse,
    isCreateItemRequest,
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
    type CrawlerHealthResponse,
    type CreateItemRequest,
    type Item,
    type ItemsResponse,
    type RestartCrawlerResponse,
    type SaveSessionRequest,
    type SaveSessionResponse,
    type UpdateItemRequest,
    type User,
    type UsersResponse,
} from '../../application/admin-api-server-types';

const BASE_URL = 'https://api.solidloop-studio.xyz/api/v1';
const publicGatewayError = () => err({ kind: 'infrastructure' as const, message: '관리자 API 요청을 처리하는 중 오류가 발생했습니다.' });
const publicUnauthorizedError = () => err({ kind: 'unauthorized' as const, message: '관리자 인증이 필요합니다.' });
const validationError = () => err({ kind: 'validation' as const, message: '올바른 요청 값이 필요합니다.' });

export interface AdminAccessTokenProvider {
    getAccessToken(): Promise<Result<string>>;
}

export interface AxiosLikeClient {
    get(url: string, config?: Record<string, unknown>): Promise<unknown>;
    post(url: string, data?: unknown, config?: Record<string, unknown>): Promise<unknown>;
    put(url: string, data?: unknown, config?: Record<string, unknown>): Promise<unknown>;
    delete(url: string, config?: Record<string, unknown>): Promise<unknown>;
}

export type GzipDecoder = (bytes: Uint8Array) => Promise<Uint8Array>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getResponseData = (response: unknown): unknown => (
    isRecord(response) ? response.data : undefined
);

const isGzip = (value: Uint8Array) => value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;

const decodeBrowserGzip: GzipDecoder = async (bytes) => {
    if (typeof DecompressionStream === 'undefined') throw new Error('gzip decoder unavailable');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** ArrayBuffer 로그 응답을 브라우저 표준 API만 사용해 UTF-8 텍스트로 변환합니다. */
export const decodeAdminApiServerLog = async (body: unknown, gzipDecoder: GzipDecoder = decodeBrowserGzip): Promise<string> => {
    if (Object.prototype.toString.call(body) !== '[object ArrayBuffer]') throw new Error('invalid log body');
    const bytes = new Uint8Array(body as ArrayBuffer);
    const decoded = isGzip(bytes) ? await gzipDecoder(bytes) : bytes;
    return new TextDecoder().decode(decoded);
};

/** Axios와 인증 토큰을 Infrastructure에 한정한 관리자 API gateway입니다. */
export class AxiosAdminApiServerGateway implements AdminApiServerGateway {
    constructor(
        private readonly client: AxiosLikeClient,
        private readonly tokenProvider: AdminAccessTokenProvider,
        private readonly gzipDecoder: GzipDecoder = decodeBrowserGzip,
    ) {}

    private async request<T>(
        call: (headers: Record<string, string>) => Promise<unknown>,
        isValid: (value: unknown) => value is T,
    ): Promise<Result<T>> {
        try {
            const tokenResult = await this.tokenProvider.getAccessToken();
            if (!tokenResult.ok) return tokenResult.error.kind === 'unauthorized' ? publicUnauthorizedError() : publicGatewayError();
            const response = await call({ Authorization: tokenResult.value });
            const data = getResponseData(response);
            return isValid(data) ? ok(data) : publicGatewayError();
        } catch {
            return publicGatewayError();
        }
    }

    private async requestVoid(call: (headers: Record<string, string>) => Promise<unknown>): Promise<Result<void>> {
        try {
            const tokenResult = await this.tokenProvider.getAccessToken();
            if (!tokenResult.ok) return tokenResult.error.kind === 'unauthorized' ? publicUnauthorizedError() : publicGatewayError();
            await call({ Authorization: tokenResult.value });
            return ok(undefined);
        } catch {
            return publicGatewayError();
        }
    }

    fetchCrawlerHealth(): Promise<Result<CrawlerHealthResponse>> {
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/crawler/health`, { headers }), isCrawlerHealthResponse);
    }
    saveCrawlerSession(data: SaveSessionRequest): Promise<Result<SaveSessionResponse>> {
        if (!isSaveSessionRequest(data)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.post(`${BASE_URL}/admin/crawler/session`, data, { headers }), isSaveSessionResponse);
    }
    restartCrawler(channelId: string): Promise<Result<RestartCrawlerResponse>> {
        if (!isNonBlankString(channelId)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.post(`${BASE_URL}/admin/crawler/restart/${channelId}`, {}, { headers }), isRestartCrawlerResponse);
    }
    fetchItems(page = 1): Promise<Result<ItemsResponse>> {
        if (!isPositiveSafePage(page)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/item/items`, { headers, params: { page } }), isItemsResponse);
    }
    createItem(data: CreateItemRequest): Promise<Result<Item>> {
        if (!isCreateItemRequest(data)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.post(`${BASE_URL}/admin/item`, data, { headers }), isItem);
    }
    updateItem(id: string, data: UpdateItemRequest): Promise<Result<Item>> {
        if (!isNonBlankString(id) || !isUpdateItemRequest(data)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.put(`${BASE_URL}/admin/item/${id}`, data, { headers }), isItem);
    }
    deleteItem(id: string): Promise<Result<void>> {
        if (!isNonBlankString(id)) return Promise.resolve(validationError());
        return this.requestVoid((headers) => this.client.delete(`${BASE_URL}/admin/item/${id}`, { headers }));
    }
    searchItems(name: string, page = 1): Promise<Result<ItemsResponse>> {
        if (!isNonBlankString(name) || !isPositiveSafePage(page)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/item/items/name/${encodeURIComponent(name)}`, { headers, params: { page } }), isItemsResponse);
    }
    searchItemsByGroup(group: string, page = 1): Promise<Result<ItemsResponse>> {
        if (!isNonBlankString(group) || !isPositiveSafePage(page)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/item/items/group/${encodeURIComponent(group)}`, { headers, params: { page } }), isItemsResponse);
    }
    fetchUsers(page = 1): Promise<Result<UsersResponse>> {
        if (!isPositiveSafePage(page)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/user/users`, { headers, params: { page } }), isUsersResponse);
    }
    fetchUserById(id: string): Promise<Result<UsersResponse>> {
        if (!isNonBlankString(id)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/user/users/id/${id}`, { headers }), isUsersResponse);
    }
    searchUsersByNickname(nickname: string): Promise<Result<UsersResponse>> {
        if (!isNonBlankString(nickname)) return Promise.resolve(validationError());
        return this.request((headers) => this.client.get(`${BASE_URL}/admin/user/users/nickname/${encodeURIComponent(nickname)}`, { headers }), isUsersResponse);
    }
    updateUserPublicStatus(id: string, isPublic: boolean): Promise<Result<User>> {
        if (!isNonBlankString(id) || typeof isPublic !== 'boolean') return Promise.resolve(validationError());
        return this.request((headers) => this.client.put(`${BASE_URL}/admin/user/public-status/${id}`, { isPublic }, { headers }), isUser);
    }
    updateUserLastOnlineHiddenStatus(id: string, isLastOnlineHidden: boolean): Promise<Result<User>> {
        if (!isNonBlankString(id) || typeof isLastOnlineHidden !== 'boolean') return Promise.resolve(validationError());
        return this.request((headers) => this.client.put(`${BASE_URL}/admin/user/last-online-hidden/${id}`, { isLastOnlineHidden }, { headers }), isUser);
    }
    async fetchApiServerLogs(date?: string): Promise<Result<string>> {
        return this.fetchLogsDecoded('/admin/logs/api-server', date);
    }
    async fetchCrawlerLogs(date?: string): Promise<Result<string>> {
        return this.fetchLogsDecoded('/admin/logs/crawler', date);
    }
    private async fetchLogsDecoded(path: string, date?: string): Promise<Result<string>> {
        if (date !== undefined && !isValidLogDate(date)) return validationError();
        try {
            const tokenResult = await this.tokenProvider.getAccessToken();
            if (!tokenResult.ok) return tokenResult.error.kind === 'unauthorized' ? publicUnauthorizedError() : publicGatewayError();
            const response = await this.client.get(`${BASE_URL}${path}`, {
                headers: { Authorization: tokenResult.value },
                params: date ? { date } : {},
                responseType: 'arraybuffer',
            });
            return ok(await decodeAdminApiServerLog(getResponseData(response), this.gzipDecoder));
        } catch {
            return publicGatewayError();
        }
    }
}
