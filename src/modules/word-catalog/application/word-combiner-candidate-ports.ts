import type { Result } from '../../../shared/application/result';
import type { WordCombinerCandidate } from './word-combiner-candidate-types';

/** 글자조각 조합기 후보 단어를 조회한다. */
export interface WordCombinerCandidateQueryGateway {
    load(): Promise<Result<WordCombinerCandidate[]>>;
}
