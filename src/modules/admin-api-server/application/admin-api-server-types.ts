export interface ChannelHealth {
    id: string;
    healthy: boolean;
}

export interface CrawlerHealthResponse { channels: ChannelHealth[]; }
export interface SaveSessionRequest { channelId: string; jwtToken: string; refreshToken: string; }
export interface SaveSessionResponse { message: string; }
export interface RestartCrawlerResponse { status: string; channel: string; }

export interface ItemOption { [key: string]: number | undefined; }
export interface Item { id: string; name: string; description: string; updatedAt: number; group: string; options: ItemOption; }
export interface ItemsResponse { items: Item[]; totalCount: number; currentPage: number; totalPages: number; }
export interface CreateItemRequest { id: string; name: string; description: string; group: string; options: ItemOption; }
export interface UpdateItemRequest { name?: string; description?: string; group?: string; options?: ItemOption; }

export interface User {
    id: string;
    nickname: string;
    exp: number;
    observedAt: string;
    exordial: string;
    level: number;
    isPublic: boolean;
    isLastOnlineHidden: boolean;
}

export interface UsersResponse { items: User[]; totalCount: number; currentPage: number; totalPages: number; }

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isNonBlankString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

export const isPositiveSafePage = (value: unknown): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
);

const isNonNegativeFiniteNumber = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0
);

export const isItemOption = (value: unknown): value is ItemOption => (
    isRecord(value) && Object.values(value).every((option) => typeof option === 'number' && Number.isFinite(option))
);

export const isCrawlerHealthResponse = (value: unknown): value is CrawlerHealthResponse => (
    isRecord(value)
    && Array.isArray(value.channels)
    && value.channels.every((channel) => isRecord(channel) && isNonBlankString(channel.id) && typeof channel.healthy === 'boolean')
);

export const isSaveSessionRequest = (value: unknown): value is SaveSessionRequest => (
    isRecord(value)
    && isNonBlankString(value.channelId)
    && isNonBlankString(value.jwtToken)
    && isNonBlankString(value.refreshToken)
);

export const isSaveSessionResponse = (value: unknown): value is SaveSessionResponse => (
    isRecord(value) && typeof value.message === 'string'
);

export const isRestartCrawlerResponse = (value: unknown): value is RestartCrawlerResponse => (
    isRecord(value) && typeof value.status === 'string' && isNonBlankString(value.channel)
);

export const isItem = (value: unknown): value is Item => (
    isRecord(value)
    && isNonBlankString(value.id)
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && isNonNegativeFiniteNumber(value.updatedAt)
    && typeof value.group === 'string'
    && isItemOption(value.options)
);

export const isCreateItemRequest = (value: unknown): value is CreateItemRequest => (
    isRecord(value)
    && isNonBlankString(value.id)
    && isNonBlankString(value.name)
    && typeof value.description === 'string'
    && isNonBlankString(value.group)
    && isItemOption(value.options)
);

export const isUpdateItemRequest = (value: unknown): value is UpdateItemRequest => {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    if (keys.length === 0 || keys.some((key) => !['name', 'description', 'group', 'options'].includes(key))) return false;
    return (value.name === undefined || typeof value.name === 'string')
        && (value.description === undefined || typeof value.description === 'string')
        && (value.group === undefined || typeof value.group === 'string')
        && (value.options === undefined || isItemOption(value.options));
};

export const isItemsResponse = (value: unknown): value is ItemsResponse => (
    isRecord(value)
    && Array.isArray(value.items)
    && value.items.every(isItem)
    && isNonNegativeFiniteNumber(value.totalCount)
    && isNonNegativeFiniteNumber(value.currentPage)
    && isNonNegativeFiniteNumber(value.totalPages)
);

export const isUser = (value: unknown): value is User => (
    isRecord(value)
    && isNonBlankString(value.id)
    && isNonBlankString(value.nickname)
    && isNonNegativeFiniteNumber(value.exp)
    && typeof value.observedAt === 'string'
    && typeof value.exordial === 'string'
    && isNonNegativeFiniteNumber(value.level)
    && typeof value.isPublic === 'boolean'
    && typeof value.isLastOnlineHidden === 'boolean'
);

export const isUsersResponse = (value: unknown): value is UsersResponse => (
    isRecord(value)
    && Array.isArray(value.items)
    && value.items.every(isUser)
    && isNonNegativeFiniteNumber(value.totalCount)
    && isNonNegativeFiniteNumber(value.currentPage)
    && isNonNegativeFiniteNumber(value.totalPages)
);

export const isValidLogDate = (value: unknown): value is string => {
    if (!isNonBlankString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
