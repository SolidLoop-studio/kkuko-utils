import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok } from '@/src/shared/application/result';

jest.mock('../../../../../shared/infrastructure/supabase/browser-client', () => ({
    browserSupabaseClient: { rpc: jest.fn() },
}));

import { SupabaseUserWordThemeRequestGateway } from '@/src/modules/word-requests/infrastructure/browser/supabase-user-word-theme-request-gateway';

type RpcResponse = { data: unknown; error: { code?: string | null; message: string } | null };
type Rpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown>]>;

const command = {
    word: '나비',
    changes: [
        { themeCode: 'A', type: 'add' as const },
        { themeCode: 'Z', type: 'delete' as const },
    ],
};
const successfulResult = {
    word: '나비',
    changes: [
        { themeCode: 'A', themeName: '동물', type: 'add' },
        { themeCode: 'Z', themeName: '식물', type: 'delete' },
    ],
};
const infrastructureError: ApplicationError = {
    kind: 'infrastructure',
    message: '데이터 처리 중 오류가 발생했습니다.',
};

const createGateway = () => {
    const rpc: Rpc = jest.fn();
    return { rpc, gateway: new SupabaseUserWordThemeRequestGateway({ rpc }) };
};

describe('SupabaseUserWordThemeRequestGateway', () => {
    it('submits normalized theme changes to the dedicated RPC and returns its valid result', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: successfulResult, error: null });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(ok(successfulResult));
        expect(rpc).toHaveBeenCalledWith('request_word_theme_changes', {
            p_word: '나비',
            p_changes: [
                { themeCode: 'A', type: 'add' },
                { themeCode: 'Z', type: 'delete' },
            ],
        });
    });

    it.each([
        ['a non-object result', null],
        ['a different word', { ...successfulResult, word: '고래' }],
        ['a missing changes array', { word: '나비' }],
        ['a blank theme name', { word: '나비', changes: [{ themeCode: 'A', themeName: ' ', type: 'add' }, successfulResult.changes[1]] }],
        ['a malformed change', { word: '나비', changes: [{ themeCode: 'A', themeName: '동물' }, successfulResult.changes[1]] }],
        ['a duplicated response theme code', { word: '나비', changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }, { themeCode: 'A', themeName: '식물', type: 'delete' }] }],
        ['a missing requested pair', { word: '나비', changes: [successfulResult.changes[0]] }],
        ['an unexpected response pair', { word: '나비', changes: [{ themeCode: 'A', themeName: '동물', type: 'add' }, { themeCode: 'Y', themeName: '식물', type: 'delete' }] }],
        ['an unstably sorted response', { word: '나비', changes: [successfulResult.changes[1], successfulResult.changes[0]] }],
    ])('returns an infrastructure error for %s', async (_description, data) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data, error: null });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err(infrastructureError));
    });

    it('rejects inherited response keys', async () => {
        const { gateway, rpc } = createGateway();
        const inheritedData = Object.create({ word: '나비', changes: successfulResult.changes });
        rpc.mockResolvedValue({ data: inheritedData, error: null });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err(infrastructureError));
    });

    it('returns an infrastructure error when the RPC throws', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockRejectedValue(new Error('sensitive database implementation detail'));

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err(infrastructureError));
    });

    it('hides unknown database text while preserving the database error code', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST999', message: 'sensitive database implementation detail' },
        });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err({
            ...infrastructureError,
            code: 'PGRST999',
        }));
    });

    it('does not treat inherited keys such as constructor as public error codes', async () => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'constructor' } });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err({
            ...infrastructureError,
            code: 'P0001',
        }));
    });

    it('does not expose an inherited database error code', async () => {
        const { gateway, rpc } = createGateway();
        const inheritedCodeError: { message: string } = Object.create({ code: 'P0001' });
        inheritedCodeError.message = 'WORD_THEME_REQUEST_UNAUTHORIZED';
        rpc.mockResolvedValue({ data: null, error: inheritedCodeError });

        await expect(gateway.requestThemeChanges(command)).resolves.toEqual(err({
            kind: 'unauthorized',
            message: '인증이 필요합니다.',
        }));
    });

    it.each([
        ['WORD_THEME_REQUEST_UNAUTHORIZED', 'unauthorized'],
        ['WORD_THEME_REQUEST_INVALID_INPUT', 'validation'],
        ['WORD_THEME_REQUEST_NOT_FOUND', 'not-found'],
        ['WORD_THEME_REQUEST_CONFLICT', 'conflict'],
        ['WORD_THEME_REQUEST_INTERNAL_ERROR', 'infrastructure'],
    ])('maps public %s database errors to safe application errors', async (message, kind) => {
        const { gateway, rpc } = createGateway();
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } });

        const result = await gateway.requestThemeChanges(command);

        expect(result).toMatchObject({ ok: false, error: { kind, code: 'P0001' } });
        if (!result.ok) {
            expect(result.error.message).not.toBe(message);
        }
    });
});
