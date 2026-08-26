import { RegisterNicknameService } from '@/src/modules/identity/application/register-nickname';
import type { NicknameCommandGateway } from '@/src/modules/identity/application/nickname-ports';
import { err, ok } from '@/src/shared/application/result';

const profile = { id: 'user-1', nickname: '테스터', role: 'guest' as const };

describe('RegisterNicknameService', () => {
    it('sends only the normalized nickname to the command gateway', async () => {
        // Break caught: accepting a UI-controlled actor, UUID, or role in the registration command.
        const gateway: NicknameCommandGateway = {
            register: jest.fn().mockResolvedValue(ok(profile)),
        };
        const service = new RegisterNicknameService(gateway);

        await expect(service.register('  테스터  ')).resolves.toEqual(ok(profile));
        expect(gateway.register).toHaveBeenCalledWith('테스터');
        expect(gateway.register).not.toHaveBeenCalledWith(expect.objectContaining({
            actorId: expect.anything(),
            id: expect.anything(),
            role: expect.anything(),
        }));
    });

    it('rejects the current empty-after-trim invalid input without registering', async () => {
        // Break caught: sending an empty nickname to the authenticated command boundary.
        const gateway: NicknameCommandGateway = { register: jest.fn() };
        const service = new RegisterNicknameService(gateway);

        await expect(service.register('\t ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'nickname',
            message: '닉네임을 입력해주세요.',
        }));
        expect(gateway.register).not.toHaveBeenCalled();
    });

    it('preserves the stable conflict returned by the database-backed command', async () => {
        // Break caught: losing the unique-constraint race classification in Application.
        const conflict = {
            kind: 'conflict' as const,
            message: '이미 사용 중인 닉네임입니다.',
            code: 'NICKNAME_CONFLICT',
        };
        const gateway: NicknameCommandGateway = {
            register: jest.fn().mockResolvedValue(err(conflict)),
        };
        const service = new RegisterNicknameService(gateway);

        await expect(service.register('테스터')).resolves.toEqual(err(conflict));
    });

    it('rejects a successful profile whose nickname differs from the normalized command', async () => {
        // Break caught: projecting a malformed or unrelated successful user row into Redux.
        const gateway: NicknameCommandGateway = {
            register: jest.fn().mockResolvedValue(ok({ ...profile, nickname: '다른닉네임' })),
        };
        const service = new RegisterNicknameService(gateway);

        await expect(service.register('테스터')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '닉네임 등록 중 오류가 발생했습니다.',
        }));
    });

    it('converts thrown command details to a stable application error', async () => {
        // Break caught: leaking authentication or database exceptions from a gateway.
        const gateway: NicknameCommandGateway = {
            register: jest.fn().mockRejectedValue(new Error('private command detail')),
        };
        const service = new RegisterNicknameService(gateway);

        await expect(service.register('테스터')).resolves.toEqual(err({
            kind: 'infrastructure',
            message: '닉네임 등록 중 오류가 발생했습니다.',
        }));
    });
});
