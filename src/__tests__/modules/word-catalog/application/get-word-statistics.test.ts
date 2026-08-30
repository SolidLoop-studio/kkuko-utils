import { err, ok } from '../../../../shared/application/result';
import { GetWordStatisticsService } from '../../../../modules/word-catalog/application/get-word-statistics';
import type { WordStatisticsQueryGateway } from '../../../../modules/word-catalog/application/word-statistics-ports';
import type { WordStatistics } from '../../../../modules/word-catalog/application/word-statistics-types';

const statistics: WordStatistics = {
    firstLetter: [{
        letter: '가',
        acknowledgedCount: 11,
        notAcknowledgedCount: 7,
        acknowledgedUpdatedAt: '2026-08-24T00:00:00Z',
        notAcknowledgedUpdatedAt: null,
    }],
    lastLetter: [],
    threeLetter: [],
};

const createGateway = (): jest.Mocked<WordStatisticsQueryGateway> => ({
    load: jest.fn(),
});

describe('GetWordStatisticsService', () => {
    test('returns the statistics projection loaded by its gateway', async () => {
        const gateway = createGateway();
        gateway.load.mockResolvedValue(ok(statistics));

        await expect(new GetWordStatisticsService(gateway).get()).resolves.toEqual(ok(statistics));
    });

    test('returns an infrastructure failure from its gateway unchanged', async () => {
        const gateway = createGateway();
        const failure = err<WordStatistics>({
            kind: 'infrastructure',
            message: '데이터를 불러오는 중 오류가 발생했습니다.',
        });
        gateway.load.mockResolvedValue(failure);

        await expect(new GetWordStatisticsService(gateway).get()).resolves.toEqual(failure);
    });
});
