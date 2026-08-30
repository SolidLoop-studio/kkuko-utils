import type { Result } from '../../../shared/application/result';
import type { WordStatisticsQueryGateway } from './word-statistics-ports';
import type { WordStatistics } from './word-statistics-types';

/** 단어 통계 투영을 조회한다. */
export class GetWordStatisticsService {
    constructor(private readonly gateway: WordStatisticsQueryGateway) {}

    async get(): Promise<Result<WordStatistics>> {
        return this.gateway.load();
    }
}
