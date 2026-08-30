import { SupabaseProfileNicknameCommandGateway } from '@/src/modules/identity/infrastructure/browser/supabase-profile-nickname-command-gateway';
import { ok } from '@/src/shared/application/result';

type HttpResponse = { ok: boolean; json(): Promise<unknown> };
type FetchClient = jest.Mock<Promise<HttpResponse>, [string, RequestInit]>;

const response = (body: unknown, isOk = true): HttpResponse => ({
    ok: isOk,
    json: () => Promise.resolve(body),
});

const createGateway = () => {
    const fetchClient: FetchClient = jest.fn();
    return { fetchClient, gateway: new SupabaseProfileNicknameCommandGateway(fetchClient) };
};

describe('SupabaseProfileNicknameCommandGateway', () => {
    it('posts the canonical nickname only and projects the authenticated user', async () => {
        // Break caught: sending caller-controlled actor identity or returning a DB row to presentation.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response({
            data: { id: 'user-1', nickname: '변경닉네임', role: null },
            error: null,
        }));

        await expect(gateway.update('변경닉네임')).resolves.toEqual(ok({
            id: 'user-1',
            nickname: '변경닉네임',
            role: 'guest',
        }));
        const [url, init] = fetchClient.mock.calls[0];
        expect(url).toBe('/api/auth/update_nickname');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ nickname: '변경닉네임' });
    });

    it.each([
        ['NICKNAME_INVALID', 'validation', '닉네임을 입력해주세요.'],
        ['NICKNAME_UNAUTHORIZED', 'unauthorized', '인증이 필요합니다.'],
        ['NICKNAME_CONFLICT', 'conflict', '이미 사용 중인 닉네임입니다.'],
    ])('maps %s to the stable %s application error', async (code, kind, message) => {
        // Break caught: exposing route codes or raw HTTP failures to presentation.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response({ data: null, error: { code } }, false));

        await expect(gateway.update('변경닉네임')).resolves.toMatchObject({
            ok: false,
            error: { kind, message },
        });
    });

    it.each([
        ['missing envelope', { data: null }],
        ['missing row', { data: null, error: null }],
        ['wrong nickname', { data: { id: 'user-1', nickname: '다른닉네임', role: 'r1' }, error: null }],
        ['invalid id', { data: { id: 1, nickname: '변경닉네임', role: 'r1' }, error: null }],
        ['invalid role', { data: { id: 'user-1', nickname: '변경닉네임', role: 'owner' }, error: null }],
    ])('maps %s to stable infrastructure failure', async (_description, body) => {
        // Break caught: trusting malformed server success or an incomplete response envelope.
        const { fetchClient, gateway } = createGateway();
        fetchClient.mockResolvedValue(response(body));

        await expect(gateway.update('변경닉네임')).resolves.toEqual({
            ok: false,
            error: {
                kind: 'infrastructure',
                message: '닉네임 변경 중 오류가 발생했습니다.',
            },
        });
    });

    it('sanitizes returned and thrown infrastructure details', async () => {
        // Break caught: leaking PostgREST or fetch diagnostics into the feature hook.
        const returned = createGateway();
        returned.fetchClient.mockResolvedValue(response({
            data: null,
            error: { code: '23505', message: 'private database detail' },
        }, false));
        const thrown = createGateway();
        thrown.fetchClient.mockRejectedValue(new Error('private network detail'));

        const returnedResult = await returned.gateway.update('변경닉네임');
        const thrownResult = await thrown.gateway.update('변경닉네임');

        expect(returnedResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(thrownResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(JSON.stringify([returnedResult, thrownResult])).not.toMatch(/private|23505/i);
    });
});
