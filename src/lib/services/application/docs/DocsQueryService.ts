import type { IDocsRepository } from '../../domain/docs/DocsRepository';
import type { IWaitDocsRepository } from '../../domain/docs/WaitDocsRepository';
import type { Result, CustomError } from '../../domain/result';
import type {
	DocsWithUser,
	DocsEntity,
	DocsLogEntity,
	DocsLogWithDocs,
	WaitDocsWithUser,
	DocsLogFilter,
	DocsWordCountInput,
} from '../../domain/docs/DocsEntity';

/**
 * Docs 조회 서비스 (Application Layer)
 *
 * 문제집 및 대기 문제집 요청에 대한 읽기 전용 유즈케이스를 담당합니다.
 * 모든 메서드는 저장소(Repository)로 단순 위임합니다.
 */
export class DocsQueryService {
	constructor(
		private readonly docsRepo: IDocsRepository,
		private readonly waitDocsRepo: IWaitDocsRepository,
	) {}

	/**
	 * 모든 문제집을 조회합니다.
	 *
	 * @returns 사용자 정보가 포함된 문제집 배열
	 */
	async getAllDocs(): Promise<Result<DocsWithUser[], CustomError>> {
		return this.docsRepo.findAll();
	}

	/**
	 * ID로 문제집을 조회합니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 사용자 정보가 포함된 문제집 또는 null
	 */
	async getDocsById(id: number): Promise<Result<DocsWithUser | null, CustomError>> {
		return this.docsRepo.findById(id);
	}

	/**
	 * 문자형 문제집을 조회합니다.
	 *
	 * @returns 문자형 문제집 배열
	 */
	async getLetterDocs(): Promise<Result<DocsEntity[], CustomError>> {
		return this.docsRepo.findByType('letter');
	}

	/**
	 * 테마 이름 배열로 문제집을 조회합니다.
	 *
	 * @param names - 테마 이름 배열
	 * @returns 문제집 배열
	 */
	async getDocsByThemeNames(names: string[]): Promise<Result<DocsEntity[], CustomError>> {
		return this.docsRepo.findByThemeNames(names);
	}

	/**
	 * 문제집의 마지막 업데이트 시간을 조회합니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 마지막 업데이트 시각 문자열 또는 null
	 */
	async getDocsLastUpdate(id: number): Promise<Result<string | null, CustomError>> {
		return this.docsRepo.findLastUpdate(id);
	}

	/**
	 * 문제집의 단어 개수를 조회합니다.
	 *
	 * @param input - 단어 개수 조회 입력 파라미터
	 * @returns 단어 개수
	 */
	async getDocsWordCount(input: DocsWordCountInput): Promise<Result<number, CustomError>> {
		return this.docsRepo.findWordCount(input);
	}

	/**
	 * 문제집의 조회수 랭킹을 조회합니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 순위 번호
	 */
	async getDocsViewRank(id: number): Promise<Result<number, CustomError>> {
		return this.docsRepo.findViewRank(id);
	}

	/**
	 * 문제집의 별 개수(좋아요 수)를 조회합니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 별 개수
	 */
	async getDocsStarCount(id: number): Promise<Result<number, CustomError>> {
		return this.docsRepo.findStarCount(id);
	}

	/**
	 * 문제집을 별표한 사용자 목록을 조회합니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 사용자 ID 배열
	 */
	async getDocsStarUsers(id: number): Promise<Result<string[], CustomError>> {
		return this.docsRepo.findStarUsers(id);
	}

	/**
	 * 특정 문제집의 변경 로그를 조회합니다.
	 *
	 * @param docsId - 문제집 ID
	 * @returns 변경 로그 배열
	 */
	async getDocsLogs(docsId: number): Promise<Result<DocsLogEntity[], CustomError>> {
		return this.docsRepo.findLogs(docsId);
	}

	/**
	 * 필터 조건에 맞는 변경 로그를 조회합니다.
	 *
	 * @param filter - 로그 필터 옵션
	 * @returns 문제집 정보가 포함된 로그 배열 및 전체 개수
	 */
	async getDocsLogsByFilter(
		filter: DocsLogFilter,
	): Promise<Result<{ data: DocsLogWithDocs[]; count: number }, CustomError>> {
		return this.docsRepo.findLogsByFilter(filter);
	}

	/**
	 * 모든 대기 중인 문제집 요청을 조회합니다.
	 *
	 * @returns 사용자 정보가 포함된 대기 요청 배열
	 */
	async getAllWaitDocs(): Promise<Result<WaitDocsWithUser[], CustomError>> {
		return this.waitDocsRepo.findAll();
	}
}
