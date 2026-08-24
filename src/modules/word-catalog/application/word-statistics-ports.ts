import type { Result } from '../../../shared/application/result';
import type { WordStatistics } from './word-statistics-types';

/** 단어 통계를 조회한다. */
export interface WordStatisticsQueryGateway {
    load(): Promise<Result<WordStatistics>>;
}
