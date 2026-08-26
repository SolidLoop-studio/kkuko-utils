import { SupabaseNicknameCommandGateway } from '@/src/modules/identity/infrastructure/browser/supabase-nickname-command-gateway';
import { ok } from '@/src/shared/application/result';

type ResponseBody = unknown;
type HttpResponse = { ok: boolean; json(): Promise<ResponseBody> };
type FetchClient = jest.Mock<Promise<HttpResponse>, [string, RequestInit]>;

const createGateway = () => {
    const fetchClient: FetchClient = jest.fn();
    return { fetchClient, gateway: new SupabaseNicknameCommandGateway(fetchClient) };
};

const response = (body: ResponseBody, isOk = true): HttpResponse => ({
    ok: isOk,
    json: () => Promise.resolve(body),
});

describe('SupabaseNicknameCommandGateway', () => {
    it('posts the normalized nickname only and projects the authenticated actor row', async () => {
        // Break caught: accepting or emitting a caller-controlled actor UUID or role.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response({
            data: { id: 'user-1', nickname: '테스터', role: null },
            error: null,
        }));

        await expect(gateway.register('테스터')).resolves.toEqual(ok({
            id: 'user-1',
            nickname: '테스터',
            role: 'guest',
        }));
        expect(fetchClient).toHaveBeenCalledTimes(1);
        const [url, init] = fetchClient.mock.calls[0];
        expect(url).toBe('/api/auth/set_nickname');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ nickname: '테스터' });
        expect(JSON.parse(String(init.body))).not.toEqual(expect.objectContaining({
            actorId: expect.anything(),
            id: expect.anything(),
            role: expect.anything(),
        }));
    });

    it('maps a concurrent unique violation to one stable conflict', async () => {
        // Break caught: exposing a 23505 duplicate race or treating it as a generic failure.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response({
            data: null,
            error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint users_nickname_key',
            },
        }, false));

        const result = await gateway.register('테스터');

        expect(result).toMatchObject({
            ok: false,
            error: {
                kind: 'conflict',
                code: 'NICKNAME_CONFLICT',
                message: '이미 사용 중인 닉네임입니다.',
            },
        });
        if (!result.ok) expect(result.error.message).not.toContain('users_nickname_key');
    });

    it.each([
        ['no session', 'unauthorized', '인증이 필요합니다.'],
        ['invalid data', 'validation', '닉네임을 입력해주세요.'],
    ])('maps %s without exposing the raw server value', async (serverError, kind, message) => {
        // Break caught: leaking existing route-handler auth/validation sentinel strings.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response({ data: null, error: serverError }, false));

        await expect(gateway.register('테스터')).resolves.toMatchObject({
            ok: false,
            error: { kind, message },
        });
    });

    it.each([
        ['missing body data', { error: null }],
        ['missing row', { data: null, error: null }],
        ['malformed actor ID', { data: { id: 7, nickname: '테스터', role: 'guest' }, error: null }],
        ['different nickname', { data: { id: 'user-1', nickname: '다른닉네임', role: 'guest' }, error: null }],
        ['malformed role', { data: { id: 'user-1', nickname: '테스터', role: 'owner' }, error: null }],
    ])('rejects %s in a successful response', async (_description, body) => {
        // Break caught: projecting malformed or unrelated server rows into application state.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response(body));

        await expect(gateway.register('테스터')).resolves.toMatchObject({
            ok: false,
            error: { kind: 'infrastructure', message: '닉네임 등록 중 오류가 발생했습니다.' },
        });
    });

    it('maps unknown returned and thrown details to a stable infrastructure error', async () => {
        // Break caught: leaking raw database/auth/network errors through Result.
        const returned = createGateway();
        returned.fetchClient.mockResolvedValue(response({
            data: null,
            error: { code: 'XX999', message: 'private database detail' },
        }, false));
        const thrown = createGateway();
        thrown.fetchClient.mockRejectedValue(new Error('private network detail'));

        const returnedResult = await returned.gateway.register('테스터');
        const thrownResult = await thrown.gateway.register('테스터');

        expect(returnedResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(thrownResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        if (!returnedResult.ok) expect(returnedResult.error.message).not.toContain('private');
        if (!thrownResult.ok) expect(thrownResult.error.message).not.toContain('private');
    });
});
