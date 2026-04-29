import type { Result, CustomError } from '../result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from './UserEntity';

export interface IUserRepository {
    findById(userId: string): Promise<Result<UserEntity | null, CustomError>>;
    findByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>>;
    findByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>>;
    searchByNickname(query: string): Promise<Result<UserEntity[], CustomError>>;
    findAll(sort?: { field: UserSortField; ascending: boolean }): Promise<Result<UserEntity[], CustomError>>;
    findMonthlyRank(userId: string): Promise<Result<number, CustomError>>;
    findMonthlyContributions(userId: string): Promise<Result<UserMonthlyContribution[], CustomError>>;
    findStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>>;
    findWaitWordRequests(userId: string): Promise<Result<UserWaitWordRequest[], CustomError>>;
    findWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>>;
    incrementContribution(userId: string, amount?: number): Promise<Result<void, CustomError>>;
    addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>>;
    removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>>;
    setNickname(nickname: string): Promise<Result<void, CustomError>>;
}
