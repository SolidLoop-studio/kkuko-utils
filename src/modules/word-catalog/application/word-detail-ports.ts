import type { Result } from '../../../shared/application/result';
import type { FindRandomConnectedWordInput, WordDetail } from './word-detail-types';

export interface WordDetailQueryGateway {
    findDetail(word: string): Promise<Result<WordDetail | null>>;
    findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>>;
}
