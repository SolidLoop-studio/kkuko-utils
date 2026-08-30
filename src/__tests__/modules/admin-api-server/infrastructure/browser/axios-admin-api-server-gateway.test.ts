import { gunzipSync, gzipSync } from 'zlib';
import { TextDecoder } from 'util';
import { AxiosAdminApiServerGateway } from '@/src/modules/admin-api-server/infrastructure/browser/axios-admin-api-server-gateway';
import { err, ok } from '@/src/shared/application/result';

const BASE_URL = 'https://api.solidloop-studio.xyz/api/v1';
const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue(ok('raw-token')) };
const item = { id: 'item-1', name: '아이템', description: '', updatedAt: 1, group: 'normal', options: { gEXP: 2 } };
const user = { id: 'user-1', nickname: '끝말잇기', exp: 1, observedAt: '2026-01-01', exordial: 'x', level: 1, isPublic: true, isLastOnlineHidden: false };

Object.assign(global, { TextDecoder });

const createClient = (data: unknown = { channels: [{ id: 'channel-1', healthy: true }] }) => ({
    get: jest.fn().mockResolvedValue({ data }),
    post: jest.fn().mockResolvedValue({ data }),
    put: jest.fn().mockResolvedValue({ data }),
    delete: jest.fn().mockResolvedValue({ data }),
});

describe('AxiosAdminApiServerGateway', () => {
    beforeEach(() => tokenProvider.getAccessToken.mockResolvedValue(ok('raw-token')));

    test.each([
        ['fetchCrawlerHealth', 'get', () => gateway.fetchCrawlerHealth(), `${BASE_URL}/admin/crawler/health`, undefined, undefined, { channels: [{ id: 'channel-1', healthy: true }] }],
        ['saveCrawlerSession', 'post', () => gateway.saveCrawlerSession({ channelId: 'channel-1', jwtToken: 'jwt', refreshToken: 'refresh' }), `${BASE_URL}/admin/crawler/session`, { channelId: 'channel-1', jwtToken: 'jwt', refreshToken: 'refresh' }, undefined, { message: 'saved' }],
        ['restartCrawler', 'post', () => gateway.restartCrawler('channel-1'), `${BASE_URL}/admin/crawler/restart/channel-1`, {}, undefined, { status: 'queued', channel: 'channel-1' }],
        ['fetchItems', 'get', () => gateway.fetchItems(2), `${BASE_URL}/admin/item/items`, undefined, { page: 2 }, { items: [item], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['createItem', 'post', () => gateway.createItem({ id: 'item-1', name: '아이템', description: '', group: 'normal', options: { gEXP: 2 } }), `${BASE_URL}/admin/item`, { id: 'item-1', name: '아이템', description: '', group: 'normal', options: { gEXP: 2 } }, undefined, item],
        ['updateItem', 'put', () => gateway.updateItem('item-1', { name: '변경' }), `${BASE_URL}/admin/item/item-1`, { name: '변경' }, undefined, item],
        ['deleteItem', 'delete', () => gateway.deleteItem('item-1'), `${BASE_URL}/admin/item/item-1`, undefined, undefined, undefined],
        ['searchItems', 'get', () => gateway.searchItems('한 글자/공백', 2), `${BASE_URL}/admin/item/items/name/%ED%95%9C%20%EA%B8%80%EC%9E%90%2F%EA%B3%B5%EB%B0%B1`, undefined, { page: 2 }, { items: [item], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['searchItemsByGroup', 'get', () => gateway.searchItemsByGroup('group/a', 2), `${BASE_URL}/admin/item/items/group/group%2Fa`, undefined, { page: 2 }, { items: [item], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['fetchUsers', 'get', () => gateway.fetchUsers(2), `${BASE_URL}/admin/user/users`, undefined, { page: 2 }, { items: [user], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['fetchUserById', 'get', () => gateway.fetchUserById('user-1'), `${BASE_URL}/admin/user/users/id/user-1`, undefined, undefined, { items: [user], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['searchUsersByNickname', 'get', () => gateway.searchUsersByNickname('끝말/잇기'), `${BASE_URL}/admin/user/users/nickname/%EB%81%9D%EB%A7%90%2F%EC%9E%87%EA%B8%B0`, undefined, undefined, { items: [user], totalCount: 1, currentPage: 1, totalPages: 1 }],
        ['updateUserPublicStatus', 'put', () => gateway.updateUserPublicStatus('user-1', true), `${BASE_URL}/admin/user/public-status/user-1`, { isPublic: true }, undefined, user],
        ['updateUserLastOnlineHiddenStatus', 'put', () => gateway.updateUserLastOnlineHiddenStatus('user-1', false), `${BASE_URL}/admin/user/last-online-hidden/user-1`, { isLastOnlineHidden: false }, undefined, user],
    ] as const)('%s preserves its endpoint and raw-token authorization', async (_name, method, operation, url, body, params, response) => {
        // Break caught: changing a legacy API endpoint, query, body, or raw Authorization format during extraction.
        const client = createClient(response);
        gateway = new AxiosAdminApiServerGateway(client, tokenProvider);

        await expect(operation()).resolves.toEqual(ok(method === 'delete' ? undefined : response));
        const call = client[method].mock.calls[0];
        expect(call[0]).toBe(url);
        if (body !== undefined) expect(call[1]).toEqual(body);
        const config = call[method === 'get' || method === 'delete' ? 1 : 2] as { headers: { Authorization: string }; params?: unknown };
        expect(config.headers).toEqual({ Authorization: 'raw-token' });
        expect(config.params).toEqual(params);
    });

    test('sets arraybuffer response type and decodes plain UTF-8 and gzip log bodies identically', async () => {
        // Break caught: returning compressed bytes or changing the log endpoint configuration.
        const plainBytes = Buffer.from('line one\nline two');
        const plain = plainBytes.buffer.slice(plainBytes.byteOffset, plainBytes.byteOffset + plainBytes.byteLength) as ArrayBuffer;
        const gzipBytes = gzipSync(plainBytes);
        const gzip = gzipBytes.buffer.slice(gzipBytes.byteOffset, gzipBytes.byteOffset + gzipBytes.byteLength) as ArrayBuffer;
        const client = createClient(plain);
        gateway = new AxiosAdminApiServerGateway(client, tokenProvider, async (bytes) => new Uint8Array(gunzipSync(Buffer.from(bytes))));

        await expect(gateway.fetchApiServerLogs('2026-01-01')).resolves.toEqual(ok('line one\nline two'));
        client.get.mockResolvedValueOnce({ data: gzip });
        await expect(gateway.fetchCrawlerLogs()).resolves.toEqual(ok('line one\nline two'));
        expect(client.get.mock.calls[0][1]).toEqual({ headers: { Authorization: 'raw-token' }, params: { date: '2026-01-01' }, responseType: 'arraybuffer' });
        expect(client.get.mock.calls[1][1]).toEqual({ headers: { Authorization: 'raw-token' }, params: {}, responseType: 'arraybuffer' });
    });

    test('uses the production DecompressionStream path for gzip logs when no decoder is injected', async () => {
        // Break caught: leaving production gzip handling dependent on the test-only injected decoder.
        const gzipBytes = gzipSync(Buffer.from('default browser decoder'));
        const gzip = gzipBytes.buffer.slice(gzipBytes.byteOffset, gzipBytes.byteOffset + gzipBytes.byteLength) as ArrayBuffer;
        const previous = {
            Blob: global.Blob,
            Response: global.Response,
            DecompressionStream: global.DecompressionStream,
        };

        class BrowserBlob {
            constructor(private readonly parts: Uint8Array[]) {}
            stream() {
                return { pipeThrough: () => new Uint8Array(gunzipSync(Buffer.from(this.parts[0]))) };
            }
        }
        class BrowserResponse {
            constructor(private readonly stream: Uint8Array) {}
            async arrayBuffer(): Promise<ArrayBuffer> {
                return this.stream.buffer.slice(this.stream.byteOffset, this.stream.byteOffset + this.stream.byteLength) as ArrayBuffer;
            }
        }
        class BrowserDecompressionStream {
            constructor(format: string) { expect(format).toBe('gzip'); }
        }

        Object.assign(global, {
            Blob: BrowserBlob,
            Response: BrowserResponse,
            DecompressionStream: BrowserDecompressionStream,
        });

        try {
            await expect(new AxiosAdminApiServerGateway(createClient(gzip), tokenProvider).fetchCrawlerLogs())
                .resolves.toEqual(ok('default browser decoder'));
        } finally {
            Object.assign(global, previous);
        }
    });

    test.each([
        [{ channels: [{ id: '', healthy: true }] }],
        [{ items: [{ ...item, options: { gEXP: Number.NaN } }], totalCount: 1, currentPage: 1, totalPages: 1 }],
        [{ items: [{ ...user, level: -1 }], totalCount: 1, currentPage: 1, totalPages: 1 }],
        [{ items: [], totalCount: -1, currentPage: 1, totalPages: 1 }],
        [{ message: 1 }],
    ])('maps malformed external DTOs to a stable Infrastructure error', async (response) => {
        // Break caught: treating Axios generic data as trusted and rendering a malformed external response.
        const client = createClient(response);
        const localGateway = new AxiosAdminApiServerGateway(client, tokenProvider);

        await expect(localGateway.fetchCrawlerHealth()).resolves.toEqual(err({ kind: 'infrastructure', message: '관리자 API 요청을 처리하는 중 오류가 발생했습니다.' }));
    });

    test.each([
        ['session response', { message: 1 }, (gateway: AxiosAdminApiServerGateway) => gateway.saveCrawlerSession({ channelId: 'channel-1', jwtToken: 'jwt', refreshToken: 'refresh' })],
        ['restart response', { status: 1, channel: 'channel-1' }, (gateway: AxiosAdminApiServerGateway) => gateway.restartCrawler('channel-1')],
        ['item response', { ...item, options: { gEXP: Number.POSITIVE_INFINITY } }, (gateway: AxiosAdminApiServerGateway) => gateway.createItem({ id: 'item-1', name: '아이템', description: '', group: 'normal', options: { gEXP: 2 } })],
        ['item page response', { items: [item], totalCount: 1, currentPage: -1, totalPages: 1 }, (gateway: AxiosAdminApiServerGateway) => gateway.fetchItems()],
        ['user response', { ...user, isPublic: 'yes' }, (gateway: AxiosAdminApiServerGateway) => gateway.updateUserPublicStatus('user-1', true)],
        ['user page response', { items: [user], totalCount: 1, currentPage: 1, totalPages: Number.NaN }, (gateway: AxiosAdminApiServerGateway) => gateway.fetchUsers()],
    ])('validates each external DTO family before returning it', async (_name, response, operation) => {
        // Break caught: accepting a malformed response type merely because another API endpoint was validated.
        const localGateway = new AxiosAdminApiServerGateway(createClient(response), tokenProvider);

        await expect(operation(localGateway)).resolves.toEqual(err({ kind: 'infrastructure', message: '관리자 API 요청을 처리하는 중 오류가 발생했습니다.' }));
    });

    test('rejects malformed gateway inputs without requesting a token or constructing a URL', async () => {
        // Break caught: bypassing the gateway validation when it is called without the Application service.
        const client = createClient();
        const localTokenProvider = { getAccessToken: jest.fn().mockResolvedValue(ok('raw-token')) };
        const localGateway = new AxiosAdminApiServerGateway(client, localTokenProvider);

        await expect(localGateway.fetchItems(0)).resolves.toEqual(err({ kind: 'validation', message: '올바른 요청 값이 필요합니다.' }));
        await expect(localGateway.searchUsersByNickname('  ')).resolves.toEqual(err({ kind: 'validation', message: '올바른 요청 값이 필요합니다.' }));
        await expect(localGateway.fetchCrawlerLogs('2026-02-30')).resolves.toEqual(err({ kind: 'validation', message: '올바른 요청 값이 필요합니다.' }));
        expect(localTokenProvider.getAccessToken).not.toHaveBeenCalled();
        expect(client.get).not.toHaveBeenCalled();
    });

    test('maps token, returned transport, and thrown transport failures to one stable gateway error', async () => {
        // Break caught: leaking a token-provider or Axios diagnostic through the gateway result.
        const client = createClient();
        const localGateway = new AxiosAdminApiServerGateway(client, { getAccessToken: jest.fn().mockResolvedValue(err({ kind: 'unauthorized', message: 'private auth detail' })) });
        await expect(localGateway.fetchCrawlerHealth()).resolves.toEqual(err({ kind: 'unauthorized', message: '관리자 인증이 필요합니다.' }));
        client.get.mockResolvedValue({ data: { message: 'private error payload' } });
        await expect(new AxiosAdminApiServerGateway(client, tokenProvider).fetchCrawlerHealth()).resolves.toEqual(err({ kind: 'infrastructure', message: '관리자 API 요청을 처리하는 중 오류가 발생했습니다.' }));
        client.get.mockRejectedValue(new Error('private Axios detail'));
        await expect(new AxiosAdminApiServerGateway(client, tokenProvider).fetchCrawlerHealth()).resolves.toEqual(err({ kind: 'infrastructure', message: '관리자 API 요청을 처리하는 중 오류가 발생했습니다.' }));
    });
});

let gateway: AxiosAdminApiServerGateway;
