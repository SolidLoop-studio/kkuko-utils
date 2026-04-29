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

/**
 * User 유즈케이스 서비스 (Application Layer)
 *
 * 사용자 조회/정렬/기여도/즐겨찾기 등 읽기/쓰기 유즈케이스를 담당합니다.
 * 모든 동작은 IUserRepository로 위임됩니다.
 */
export class UserService {
    constructor(private readonly userRepo: IUserRepository) {}

    /**
     * 사용자 ID로 사용자 정보를 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 사용자 엔티티 또는 null
     */
    async getUserById(userId: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findById(userId);
    }

    /**
     * 닉네임으로 사용자 정보를 조회합니다.
     *
     * @param nickname - 사용자 닉네임
     * @returns 사용자 엔티티 또는 null
     */
    async getUserByNickname(nickname: string): Promise<Result<UserEntity | null, CustomError>> {
        return this.userRepo.findByNickname(nickname);
    }

    /**
     * 닉네임 정확 일치로 사용자 목록을 조회합니다.
     *
     * @param nickname - 사용자 닉네임
     * @returns 사용자 엔티티 배열
     */
    async getUsersByNicknameExact(nickname: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findByNicknameExact(nickname);
    }

    /**
     * 닉네임 검색어로 사용자 목록을 조회합니다.
     *
     * @param query - 검색 쿼리
     * @returns 사용자 엔티티 배열
     */
    async searchUsersByNickname(query: string): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.searchByNickname(query);
    }

    /**
     * 모든 사용자를 조회합니다.
     *
     * @param sort - 정렬 옵션
     * @returns 사용자 엔티티 배열
     */
    async getAllUsers(
        sort?: { field: UserSortField; ascending: boolean }
    ): Promise<Result<UserEntity[], CustomError>> {
        return this.userRepo.findAll(sort);
    }

    /**
     * 월간 랭킹 순위를 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 월간 랭킹 순위
     */
    async getUserMonthlyRank(userId: string): Promise<Result<number, CustomError>> {
        return this.userRepo.findMonthlyRank(userId);
    }

    /**
     * 월간 기여도 정보를 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 월간 기여도 목록
     */
    async getUserMonthlyContributions(
        userId: string
    ): Promise<Result<UserMonthlyContribution[], CustomError>> {
        return this.userRepo.findMonthlyContributions(userId);
    }

    /**
     * 사용자가 즐겨찾기한 단어장을 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 즐겨찾기 단어장 목록
     */
    async getUserStarredDocs(userId: string): Promise<Result<UserStarredDocs[], CustomError>> {
        return this.userRepo.findStarredDocs(userId);
    }

    /**
     * 사용자의 대기 단어 요청 목록을 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 대기 단어 요청 목록
     */
    async getUserWaitWordRequests(
        userId: string
    ): Promise<Result<UserWaitWordRequest[], CustomError>> {
        return this.userRepo.findWaitWordRequests(userId);
    }

    /**
     * 사용자의 단어 로그를 조회합니다.
     *
     * @param userId - 사용자 ID
     * @returns 단어 로그 목록
     */
    async getUserWordLogs(userId: string): Promise<Result<UserWordLog[], CustomError>> {
        return this.userRepo.findWordLogs(userId);
    }

    /**
     * 사용자 기여도를 증가시킵니다.
     *
     * @param userId - 사용자 ID
     * @param amount - 증가량 (기본 1)
     * @returns 처리 결과
     */
    async incrementContribution(
        userId: string,
        amount: number = 1
    ): Promise<Result<void, CustomError>> {
        return this.userRepo.incrementContribution(userId, amount);
    }

    /**
     * 단어장을 즐겨찾기에 추가합니다.
     *
     * @param userId - 사용자 ID
     * @param docsId - 단어장 ID
     * @returns 처리 결과
     */
    async addStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.addStarDocs(userId, docsId);
    }

    /**
     * 단어장을 즐겨찾기에서 제거합니다.
     *
     * @param userId - 사용자 ID
     * @param docsId - 단어장 ID
     * @returns 처리 결과
     */
    async removeStarDocs(userId: string, docsId: number): Promise<Result<void, CustomError>> {
        return this.userRepo.removeStarDocs(userId, docsId);
    }

    /**
     * 현재 사용자의 닉네임을 변경합니다.
     *
     * @param nickname - 새 닉네임
     * @returns 처리 결과
     */
    async setNickname(nickname: string): Promise<Result<void, CustomError>> {
        return this.userRepo.setNickname(nickname);
    }
}
