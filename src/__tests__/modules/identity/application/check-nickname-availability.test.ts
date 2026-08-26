import { CheckNicknameAvailabilityService } from '@/src/modules/identity/application/check-nickname-availability';
import type { NicknameQueryGateway } from '@/src/modules/identity/application/nickname-ports';
import { err, ok } from '@/src/shared/application/result';

describe('CheckNicknameAvailabilityService', () => {
    it('normalizes the nickname once before returning its availability', async () => {
        // Break caught: querying or returning the whitespace-padded nickname.
        const gateway: NicknameQueryGateway = {
            isAvailable: jest.fn().mockResolvedValue(ok(true)),
        };
        const service = new CheckNicknameAvailabilityService(gateway);

        await expect(service.check('  테스터  ')).resolves.toEqual(ok({
            nickname: '테스터',
            isAvailable: true,
        }));
        expect(gateway.isAvailable).toHaveBeenCalledWith('테스터');
    });

    it('preserves an unavailable result without turning it into an infrastructure failure', async () => {
        // Break caught: treating an existing nickname row as a failed query.
        const gateway: NicknameQueryGateway = {
            isAvailable: jest.fn().mockResolvedValue(ok(false)),
        };
        const service = new CheckNicknameAvailabilityService(gateway);

        await expect(service.check('테스터')).resolves.toEqual(ok({
            nickname: '테스터',
            isAvailable: false,
        }));
    });

    it('rejects the current empty-after-trim invalid input without querying', async () => {
        // Break caught: allowing the registration component's disabled empty nickname through Application.
        const gateway: NicknameQueryGateway = { isAvailable: jest.fn() };
        const service = new CheckNicknameAvailabilityService(gateway);

        await expect(service.check('   ')).resolves.toEqual(err({
            kind: 'validation',
            field: 'nickname',
            message: '닉네임을 입력해주세요.',
        }));
        expect(gateway.isAvailable).not.toHaveBeenCalled();
    });

    it('converts thrown query details to a stable application error', async () => {
        // Break caught: leaking thrown database details past the Application boundary.
        const gateway: NicknameQueryGateway = {
            isAvailable: jest.fn().mockRejectedValue(new Error('private query detail')),
        };
        const service = new CheckNicknameAvailabilityService(gateway);

        const result = await service.check('테스터');

        expect(result).toEqual(err({
            kind: 'infrastructure',
            message: '닉네임 확인 중 오류가 발생했습니다.',
        }));
    });
});
