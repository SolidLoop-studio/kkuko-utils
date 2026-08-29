import type { Result } from '../../../shared/application/result';
import type { WordCombinerCandidateQueryGateway } from './word-combiner-candidate-ports';
import type { WordCombinerCandidate } from './word-combiner-candidate-types';

/** 글자조각 조합기에 필요한 좁은 단어 투영을 조회한다. */
export class GetWordCombinerCandidatesService {
    constructor(private readonly gateway: WordCombinerCandidateQueryGateway) {}

    async get(): Promise<Result<WordCombinerCandidate[]>> {
        return this.gateway.load();
    }
}
