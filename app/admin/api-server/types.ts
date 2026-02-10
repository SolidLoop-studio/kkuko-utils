// API Server Admin Types

export interface ChannelHealth {
  id: string;
  healthy: boolean;
}

export interface CrawlerHealthResponse {
  channels: ChannelHealth[];
}

export interface SaveSessionRequest {
  channelId: string;
  jwtToken: string;
  refreshToken: string;
}

export interface SaveSessionResponse {
  message: string;
}

export interface RestartCrawlerResponse {
  status: string;
  channel: string;
}

export interface ItemOption {
  gEXP?: number;
  hEXP?: number;
  gMNY?: number;
  hMNY?: number;
  [key: string]: number | undefined;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
  group: string;
  options: ItemOption;
}

export interface ItemsResponse {
  items: Item[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface CreateItemRequest {
  id: string;
  name: string;
  description: string;
  group: string;
  options: ItemOption;
}

export interface UpdateItemRequest {
  name?: string;
  description?: string;
  group?: string;
  options?: ItemOption;
}

