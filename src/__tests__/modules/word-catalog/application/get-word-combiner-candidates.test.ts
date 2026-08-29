import { GetWordCombinerCandidatesService } from '@/src/modules/word-catalog/application/get-word-combiner-candidates';
import type { WordCombinerCandidateQueryGateway } from '@/src/modules/word-catalog/application/word-combiner-candidate-ports';
import { ok } from '@/src/shared/application/result';

describe('GetWordCombinerCandidatesService', () => {
    test('returns the narrow candidate projection supplied by the query gateway', async () => {
        const candidates = [{ word: '가나다라마' }, { word: '바사아자차카' }];
        const gateway: WordCombinerCandidateQueryGateway = {
            load: jest.fn().mockResolvedValue(ok(candidates)),
        };

        await expect(new GetWordCombinerCandidatesService(gateway).get()).resolves.toEqual(ok(candidates));
    });
});
