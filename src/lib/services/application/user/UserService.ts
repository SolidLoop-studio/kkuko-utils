import type { IUserRepository } from '../../domain/user/UserRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
    UserEntity,
    UserSortField,
    UserStarredDocs,
    UserMonthlyContribution,
    UserWaitWordRequest,
    UserWordLog,
} from '../../domain/user/UserEntity';

export class UserService {
    constructor(private readonly userRepo: IUserRepository) {}

    async getUserById(userId: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findById(userId);
    }

    async getUserByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findByNickname(nickname);
    }

    async getUsersByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findByNicknameExact(nickname);
    }

    async searchUsersByNickname(query: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.searchByNickname(query);
    }

    async getAllUsers(
        sort?: { field: UserSortField; ascending: boolean }
    ): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findAll(sort);
    }

    async getUserMonthlyRank(userId: string): Promise<Result<number, CustomError>> {
        return this.userRepo.findMonthlyRank(userId);
    }

    async getUserMonthlyContributions(
        userId: string
    ): Promise<Result<UserMonthlyContribution[], CustomError>> {
        return this.userRepo.findMonthlyContributions(userId);
    }

    async getUserStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>> {
        return this.userRepo.findStarredDocs(userId);
    }

    async getUserWaitWordRequests(
        userId: string
    ): Promise<Result<UserWaitWordRequest[], CustomError>> {
        return this.userRepo.findWaitWordRequests(userId);
    }

    async getUserWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>> {
        return this.userRepo.findWordLogs(userId);
    }

    async incrementContribution(
        userId: string,
        amount: number = 1
    ): Promise<Result<void, CustomError>> {
        return this.userRepo.incrementContribution(userId, amount);
    }

    async addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.addStarDocs(userId, docsId);
    }

    async removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.removeStarDocs(userId, docsId);
    }

    async setNickname(nickname: string): Promise<Result<void, CustomError>> {
        return this.userRepo.setNickname(nickname);
    }
}
