import { err, ok } from '../../../../shared/application/result';
import type { WordDetailQueryGateway } from '../../../../modules/word-catalog/application/word-detail-ports';
import { GetWordDetailService } from '../../../../modules/word-catalog/application/get-word-detail';

const createGateway = (): jest.Mocked<WordDetailQueryGateway> => ({
    findDetail: jest.fn().mockResolvedValue(ok(null)),
    findRandomConnectedWord: jest.fn().mockResolvedValue(ok(null)),
});

describe('GetWordDetailService', () => {
    it('rejects blank words', async () => {
        const gateway = createGateway();
        await expect(new GetWordDetailService(gateway).get('  ')).resolves.toEqual(
            err({ kind: 'validation', field: 'word', message: '단어가 필요합니다.' }),
        );
        expect(gateway.findDetail).not.toHaveBeenCalled();
    });

    it('forwards a trimmed word', async () => {
        const gateway = createGateway();
        const detail = { id: 1 } as never;
        gateway.findDetail.mockResolvedValue(ok(detail));
        await expect(new GetWordDetailService(gateway).get(' 나비 ')).resolves.toEqual(ok(detail));
        expect(gateway.findDetail).toHaveBeenCalledWith('나비');
    });

    it('turns a missing projection into a stable not-found error', async () => {
        const service = new GetWordDetailService(createGateway());
        await expect(service.get('나비')).resolves.toEqual(err({
            kind: 'not-found',
            code: 'WORD_NOT_FOUND',
            message: '단어 정보를 찾을 수 없습니다.',
        }));
    });

    it('forwards gateway failures unchanged', async () => {
        const gateway = createGateway();
        const failure = err({ kind: 'infrastructure', message: 'failed' });
        gateway.findDetail.mockResolvedValue(failure);
        await expect(new GetWordDetailService(gateway).get('나비')).resolves.toEqual(failure);
    });

    it('normalizes random candidate letters and forwards direction', async () => {
        const gateway = createGateway();
        gateway.findRandomConnectedWord.mockResolvedValue(ok('나비'));
        await expect(new GetWordDetailService(gateway).findRandomConnectedWord({
            direction: 'next', letters: [' 나', ' ', '비 '],
        })).resolves.toEqual(ok('나비'));
        expect(gateway.findRandomConnectedWord).toHaveBeenCalledWith({ direction: 'next', letters: ['나', '비'] });
    });

    it('rejects empty random candidates', async () => {
        const gateway = createGateway();
        await expect(new GetWordDetailService(gateway).findRandomConnectedWord({
            direction: 'previous', letters: [' ', ''],
        })).resolves.toEqual(err({ kind: 'validation', field: 'letters', message: '연결 글자가 필요합니다.' }));
        expect(gateway.findRandomConnectedWord).not.toHaveBeenCalled();
    });

    it('preserves a successful null random candidate', async () => {
        const gateway = createGateway();
        await expect(new GetWordDetailService(gateway).findRandomConnectedWord({
            direction: 'next', letters: ['나'],
        })).resolves.toEqual(ok(null));
    });
});
