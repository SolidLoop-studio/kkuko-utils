import axios from "axios";
import axiosRetry from "axios-retry";
import type { Mode, ItemInfo } from "@/src/app/types/kkuko.types";

axiosRetry(axios, {
    retries: 5,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 500;
    },
    retryDelay: (retryCount) => {
        return axiosRetry.exponentialDelay(retryCount);
    }
});

const client = axios.create({
    baseURL: 'https://api.solidloop-studio.xyz/api/v1',
    timeout: 5000,
});

export async function fetchModes() {
    return await client.get<{data: Mode[], status: number}>('/mode')
}

export async function fetchTotalUsers() {
    return await client.get('/profile/total');
}

export async function fetchProfile(query: string, type: 'nick' | 'id') {
    return await client.get(`/profile/${encodeURIComponent(query)}`, {
        params: { type }
    })
}

export async function fetchProfileByNickname(nickname: string) {
    return await client.get(`/profile/nickname/${encodeURIComponent(nickname)}`);
}

export async function fetchItems(itemsIds: string) {
    return await client.get<{data: ItemInfo[], status: number}>(`/item?query=${encodeURIComponent(itemsIds)}`);
}

export async function fetchExpRank(userId: string) {
    return await axios.get<{rank: number, id: string}>('/api/kkuko/api/ranking', {
        params: { id: userId }
    });
}

export async function fetchRanking(
    mode: string, 
    page: number = 1, 
    option: 'win' | 'exp' | 'total' = 'win'
) {
    return await client.get(`/ranking/${mode}`, {
        params: {
            page,
            option
        }
    });
}