import type { Result } from '../../../shared/application/result';
import type { FindRandomConnectedWordInput, WordDetail } from './word-detail-types';

/** 단어 상세 조회와 연결 단어 조회를 추상화하는 애플리케이션 게이트웨이. */
export interface WordDetailQueryGateway {
    findDetail(word: string): Promise<Result<WordDetail | null>>;
    findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>>;
}
