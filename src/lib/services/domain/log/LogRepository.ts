import type { Result, CustomError } from '../result';
import type { WordLogEntity, WordLogFilter } from './LogEntity';

export interface ILogRepository {
    findWordLogsByFilter(filter: WordLogFilter): Promise<Result<{ data: WordLogEntity[]; count: number }, CustomError>>;
    deleteWordLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;
    deleteDocsLogsByIds(ids: number[]): Promise<Result<void, CustomError>>;
    saveWordLogs(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<Result<void, CustomError>>;
    saveDocsLogs(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<Result<void, CustomError>>;
}
