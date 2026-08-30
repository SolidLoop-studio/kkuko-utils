import { AddWordDirectlyService } from '@/src/modules/word-moderation/application/add-word-directly';
import type { DirectWordAdditionGateway } from '@/src/modules/word-moderation/application/direct-word-addition-ports';
import { ok } from '@/src/shared/application/result';

const directResult = {
    wordId: 31,
    word: '사과',
    noinCanUse: true,
    themeIds: [4, 9],
    affectedDocsIds: [10, 20],
};

describe('AddWordDirectlyService', () => {
    it('sends only the normalized word and selected theme codes to the gateway', async () => {
        const gateway: DirectWordAdditionGateway = {
            add: jest.fn().mockResolvedValue(ok(directResult)),
        };
        const isNoin = jest.fn().mockReturnValue(true);
        const service = new AddWordDirectlyService(gateway, isNoin);

        await expect(service.add({
            word: ' 사과 ',
            themeCodes: [' place ', 'animal'],
        })).resolves.toEqual(ok(directResult));
        expect(gateway.add).toHaveBeenCalledWith({
            word: '사과',
            themeCodes: ['animal', 'place'],
        });
        expect(gateway.add).not.toHaveBeenCalledWith(expect.objectContaining({
            actorId: expect.anything(),
            role: expect.anything(),
        }));
    });

    it('does not call the gateway when validation fails', async () => {
        const gateway: DirectWordAdditionGateway = { add: jest.fn() };
        const service = new AddWordDirectlyService(gateway, () => false);

        await expect(service.add({ word: ' ', themeCodes: [] })).resolves.toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'word' },
        });
        expect(gateway.add).not.toHaveBeenCalled();
    });

    it('rejects a response whose database noin value disagrees with the pure policy', async () => {
        const gateway: DirectWordAdditionGateway = {
            add: jest.fn().mockResolvedValue(ok({ ...directResult, noinCanUse: false })),
        };
        const service = new AddWordDirectlyService(gateway, () => true);

        await expect(service.add({ word: '사과', themeCodes: ['animal'] }))
            .resolves.toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
    });
});
