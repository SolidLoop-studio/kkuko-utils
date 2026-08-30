import { UpdateProfileNicknameService } from '@/src/modules/identity/application/update-profile-nickname';
import type { ProfileNicknameCommandGateway } from '@/src/modules/identity/application/profile-nickname-command-ports';
import { err, ok } from '@/src/shared/application/result';

const profile = { id: 'user-1', nickname: '변경닉네임', role: 'r2' as const };

describe('UpdateProfileNicknameService', () => {
    it('sends only the trimmed nickname to the command gateway', async () => {
        // Break caught: accepting a UI-controlled actor UUID or role in the update command.
        const gateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockResolvedValue(ok(profile)),
        };
        const service = new UpdateProfileNicknameService(gateway);

        await expect(service.update('  변경닉네임  ')).resolves.toEqual(ok(profile));
        expect(gateway.update).toHaveBeenCalledWith('변경닉네임');
        expect(gateway.update).not.toHaveBeenCalledWith(expect.objectContaining({
            actorId: expect.anything(),
            id: expect.anything(),
            role: expect.anything(),
        }));
    });

    it('rejects blank input without reaching the gateway', async () => {
        // Break caught: sending an empty nickname to the authenticated server boundary.
        const gateway: ProfileNicknameCommandGateway = { update: jest.fn() };
        const service = new UpdateProfileNicknameService(gateway);

        await expect(service.update('\t ')).resolves.toEqual(err({
            kind: 'validation',
            code: 'NICKNAME_INVALID',
            field: 'nickname',
            message: '닉네임을 입력해주세요.',
        }));
        expect(gateway.update).not.toHaveBeenCalled();
    });

    it.each([
        {
            kind: 'unauthorized' as const,
            code: 'NICKNAME_UNAUTHORIZED',
            message: '인증이 필요합니다.',
        },
        {
            kind: 'conflict' as const,
            code: 'NICKNAME_CONFLICT',
            message: '이미 사용 중인 닉네임입니다.',
        },
    ])('preserves the stable $kind command error', async (applicationError) => {
        // Break caught: erasing an actionable stable command classification in Application.
        const gateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockResolvedValue(err(applicationError)),
        };
        const service = new UpdateProfileNicknameService(gateway);

        await expect(service.update('변경닉네임')).resolves.toEqual(err(applicationError));
    });

    it.each([
        [
            { kind: 'validation' as const, message: 'private validation detail' },
            {
                kind: 'validation' as const,
                code: 'NICKNAME_INVALID',
                field: 'nickname',
                message: '닉네임을 입력해주세요.',
            },
        ],
        [
            { kind: 'unauthorized' as const, message: 'private auth detail' },
            {
                kind: 'unauthorized' as const,
                code: 'NICKNAME_UNAUTHORIZED',
                message: '인증이 필요합니다.',
            },
        ],
        [
            { kind: 'conflict' as const, message: 'private unique detail' },
            {
                kind: 'conflict' as const,
                code: 'NICKNAME_CONFLICT',
                message: '이미 사용 중인 닉네임입니다.',
            },
        ],
    ])('normalizes a returned %s failure to the stable public error', async (returned, expected) => {
        // Break caught: trusting arbitrary adapter messages at the Application boundary.
        const gateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockResolvedValue(err(returned)),
        };

        await expect(new UpdateProfileNicknameService(gateway).update('변경닉네임'))
            .resolves.toEqual(err(expected));
    });

    it('rejects a success projection with a different nickname', async () => {
        // Break caught: applying an unrelated or malformed successful user row to local state.
        const gateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockResolvedValue(ok({ ...profile, nickname: '다른닉네임' })),
        };
        const service = new UpdateProfileNicknameService(gateway);

        await expect(service.update('변경닉네임')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '닉네임 변경 중 오류가 발생했습니다.',
        }));
    });

    it('maps returned and thrown infrastructure failures to one stable error', async () => {
        // Break caught: leaking gateway or database diagnostics through the Application boundary.
        const returnedGateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockResolvedValue(err({
                kind: 'infrastructure',
                message: 'private returned detail',
                cause: new Error('private'),
            })),
        };
        const thrownGateway: ProfileNicknameCommandGateway = {
            update: jest.fn().mockRejectedValue(new Error('private thrown detail')),
        };
        const expected = err({
            kind: 'infrastructure' as const,
            message: '닉네임 변경 중 오류가 발생했습니다.',
        });

        await expect(new UpdateProfileNicknameService(returnedGateway).update('변경닉네임'))
            .resolves.toEqual(expected);
        await expect(new UpdateProfileNicknameService(thrownGateway).update('변경닉네임'))
            .resolves.toEqual(expected);
    });
});
