import type { ILogRepository } from '../../domain/log/LogRepository';
import type { Result, CustomError } from '../../domain/result';
import type { WordLogEntity, WordLogFilter } from '../../domain/log/LogEntity';
import type { IWordLogWriter } from '../word/WordCommandService';

export class LogService implements IWordLogWriter {
    constructor(private readonly repo: ILogRepository) {}

    async getWordLogsByFilter(
        filter: WordLogFilter
    ): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>> {
        return this.repo.findWordLogsByFilter(filter);
    }

    async deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteWordLogsByIds(ids);
    }

    async deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>> {
        return this.repo.deleteDocsLogsByIds(ids);
    }

    async writeWordLog(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<void> {
        await this.repo.saveWordLogs(logsData);
    }

    async writeDocsLog(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<void> {
        await this.repo.saveDocsLogs(logsData);
    }
}
