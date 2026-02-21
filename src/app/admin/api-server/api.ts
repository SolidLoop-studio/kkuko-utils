// API Server Admin API Functions
import axios from 'axios';
import type { 
  CrawlerHealthResponse, 
  SaveSessionRequest, 
  SaveSessionResponse, 
  RestartCrawlerResponse,
  ItemsResponse,
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  UsersResponse,
  User,
  UpdateUserPublicStatusRequest
} from './types';
import { SCM } from '@/src/app/lib/supabaseClient';
import zlib from 'zlib';

const BASE_URL = 'https://api.solidloop-studio.xyz/api/v1';

// Get JWT token from Supabase session
const getAuthHeaders = async () => {
  // This should be replaced with actual Supabase session retrieval
  const token = await SCM.getJWT(); // TODO: Get from Supabase session
  return {
    Authorization: `${token}`,
  };
};

// Crawler APIs
export const fetchCrawlerHealth = async (): Promise<CrawlerHealthResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<CrawlerHealthResponse>(
    `${BASE_URL}/admin/crawler/health`,
    { headers }
  );
  return response.data;
};

export const saveCrawlerSession = async (
  data: SaveSessionRequest
): Promise<SaveSessionResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.post<SaveSessionResponse>(
    `${BASE_URL}/admin/crawler/session`,
    data,
    { headers }
  );
  return response.data;
};

export const restartCrawler = async (
  channelId: string
): Promise<RestartCrawlerResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.post<RestartCrawlerResponse>(
    `${BASE_URL}/admin/crawler/restart/${channelId}`,
    {},
    { headers }
  );
  return response.data;
};

// Item APIs
export const fetchItems = async (page: number = 1): Promise<ItemsResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<ItemsResponse>(
    `${BASE_URL}/admin/item/items`,
    { 
      headers,
      params: { page }
    }
  );
  return response.data;
};

export const createItem = async (data: CreateItemRequest): Promise<Item> => {
  const headers = await getAuthHeaders();
  const response = await axios.post<Item>(
    `${BASE_URL}/admin/item`,
    data,
    { headers }
  );
  return response.data;
};

export const updateItem = async (id: string, data: UpdateItemRequest): Promise<Item> => {
  const headers = await getAuthHeaders();
  const response = await axios.put<Item>(
    `${BASE_URL}/admin/item/${id}`,
    data,
    { headers }
  );
  return response.data;
};

export const deleteItem = async (id: string): Promise<void> => {
  const headers = await getAuthHeaders();
  await axios.delete(
    `${BASE_URL}/admin/item/${id}`,
    { headers }
  );
};

// User APIs
export const fetchUsers = async (page: number = 1): Promise<UsersResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<UsersResponse>(
    `${BASE_URL}/admin/user/users`,
    { 
      headers,
      params: { page }
    }
  );
  return response.data;
};

export const fetchUserById = async (id: string): Promise<UsersResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<UsersResponse>(
    `${BASE_URL}/admin/user/users/id/${id}`,
    { headers }
  );
  return response.data;
};


export const searchUsersByNickname = async (nickname: string): Promise<UsersResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<UsersResponse>(
    `${BASE_URL}/admin/user/users/nickname/${encodeURIComponent(nickname)}`,
    { headers }
  );
  return response.data;
};

export const updateUserPublicStatus = async (id: string, isPublic: boolean): Promise<User> => {
  const headers = await getAuthHeaders();
  const data: UpdateUserPublicStatusRequest = { isPublic };
  const response = await axios.put<User>(
    `${BASE_URL}/admin/user/public-status/${id}`,
    data,
    { headers }
  );
  return response.data;
};


export const searchItems = async (name: string, page: number = 1): Promise<ItemsResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<ItemsResponse>(
    `${BASE_URL}/admin/item/items/name/${encodeURIComponent(name)}`,
    { 
      headers,
      params: { page }
    }
  );
  return response.data;
};

export const searchItemsByGroup = async (group: string, page: number = 1): Promise<ItemsResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get<ItemsResponse>(
    `${BASE_URL}/admin/item/items/group/${encodeURIComponent(group)}`,
    { 
      headers,
      params: { page }
    }
  );
  return response.data;
};

export interface UpdateUserLastOnlineHiddenStatusRequest {
  isLastOnlineHidden: boolean;
}

export const updateUserLastOnlineHiddenStatus = async (id: string, isLastOnlineHidden: boolean): Promise<User> => {
  const headers = await getAuthHeaders();
  const data: UpdateUserLastOnlineHiddenStatusRequest = { isLastOnlineHidden };
  const response = await axios.put<User>(
    `${BASE_URL}/admin/user/last-online-hidden/${id}`,
    data,
    { headers }
  );
  return response.data;
};

// Logs APIs
const isGzip = (u8: Uint8Array) => u8 && u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b;

const arrayBufferToString = async (buf: ArrayBuffer): Promise<string> => {
  const u8 = new Uint8Array(buf);
  console.log(isGzip(u8));
  if (isGzip(u8)) {
    const decompressed = zlib.gunzipSync(Buffer.from(buf));
    return decompressed.toString('utf-8');

  }

  // Not gzipped, decode as UTF-8
  return new TextDecoder().decode(buf);
};

export const fetchApiServerLogs = async (date?: string): Promise<string> => {
  const headers = await getAuthHeaders();
  const params = date ? { date } : {};
  const response = await axios.get<ArrayBuffer>(
    `${BASE_URL}/admin/logs/api-server`,
    { headers, params, responseType: 'arraybuffer' }
  );
  return await arrayBufferToString(response.data);
};

export const fetchCrawlerLogs = async (date?: string): Promise<string> => {
  const headers = await getAuthHeaders();
  const params = date ? { date } : {};
  const response = await axios.get<ArrayBuffer>(
    `${BASE_URL}/admin/logs/crawler`,
    { headers, params, responseType: 'arraybuffer' }
  );
  return await arrayBufferToString(response.data);
};
