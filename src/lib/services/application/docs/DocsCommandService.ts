import type { IDocsRepository } from '../../domain/docs/DocsRepository';
import type { IWaitDocsRepository } from '../../domain/docs/WaitDocsRepository';
import type { Result, CustomError } from '../../domain/result';
import type { IDocsLogWriter } from '../word/WordCommandService';
import type { NewDocsLog } from '../../domain/docs/DocsEntity';

/**
 * Docs 명령 서비스 (Application Layer)
 *
 * 문제집 관련 쓰기 작업 및 WordCommandService가 사용할 IDocsLogWriter 구현을 담당합니다.
 */
export class DocsCommandService implements IDocsLogWriter {
	constructor(
		private readonly docsRepo: IDocsRepository,
		private readonly waitDocsRepo: IWaitDocsRepository,
	) {}

	// ── IDocsLogWriter 구현 (WordCommandService가 사용) ──────────────

	/**
	 * 문서 로그를 기록합니다.
	 * (IDocsLogWriter 계약: snake_case 입력을 camelCase(NewDocsLog)로 변환하여 저장)
	 *
	 * @param logsData - 저장할 로그 데이터 배열
	 */
	async writeDocsLog(
		logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[],
	): Promise<void> {
		const newLogsData: NewDocsLog[] = logsData.map((log) => ({
			docsId: log.docs_id,
			word: log.word,
			type: log.type,
			addBy: log.add_by,
		}));

		await this.docsRepo.saveLogs(newLogsData);
	}

	/**
	 * 전체 문제집 목록을 조회합니다.
	 * (IDocsLogWriter 계약: 에러 무시, 빈 배열 반환)
	 *
	 * @returns 문제집 ID, 이름, 종류 정보 배열
	 */
	async getAllDocs(): Promise<{ id: number; name: string; typez: string }[]> {
		const result = await this.docsRepo.findAll();

		if (!result.success) {
			return [];
		}

		return result.data.map((doc) => ({
			id: doc.id,
			name: doc.name,
			typez: doc.typez,
		}));
	}

	/**
	 * 문제집의 마지막 업데이트 시간을 갱신합니다.
	 * (IDocsLogWriter 계약: 에러 무시)
	 *
	 * @param docsIds - 업데이트할 문제집 ID 배열
	 */
	async updateDocsLastUpdate(docsIds: number[]): Promise<void> {
		await this.docsRepo.updateLastUpdate(docsIds);
	}

	// ── Docs 커맨드 ───────────────────────────────────────────────────

	/**
	 * 문제집에 별표를 추가합니다.
	 *
	 * @param docsId - 문제집 ID
	 * @param userId - 사용자 ID
	 * @returns 성공 or 에러
	 */
	async addStar(docsId: number, userId: string): Promise<Result<void, CustomError>> {
		return this.docsRepo.saveStar(docsId, userId);
	}

	/**
	 * 문제집의 별표를 제거합니다.
	 *
	 * @param docsId - 문제집 ID
	 * @param userId - 사용자 ID
	 * @returns 성공 or 에러
	 */
	async removeStar(docsId: number, userId: string): Promise<Result<void, CustomError>> {
		return this.docsRepo.deleteStar(docsId, userId);
	}

	/**
	 * 새로운 문제집을 요청합니다.
	 *
	 * @param docsName - 요청한 문제집 이름
	 * @param userId - 요청자 ID (nullable)
	 * @returns 성공 or 에러
	 */
	async requestDocs(docsName: string, userId: string | null): Promise<Result<void, CustomError>> {
		return this.waitDocsRepo.save(docsName, userId);
	}

	/**
	 * 대기 중인 문제집 요청을 승인합니다.
	 *
	 * @param ids - 승인할 요청 ID 배열
	 * @returns 성공 or 에러
	 */
	async approveWaitDocs(ids: number[]): Promise<Result<void, CustomError>> {
		return this.waitDocsRepo.deleteByIds(ids);
	}

	/**
	 * 문제집 변경 로그를 삭제합니다.
	 *
	 * @param ids - 삭제할 로그 ID 배열
	 * @returns 성공 or 에러
	 */
	async deleteDocsLogs(ids: number[]): Promise<Result<void, CustomError>> {
		return this.docsRepo.deleteLogsByIds(ids);
	}

	/**
	 * 문제집의 조회수를 증가시킵니다.
	 *
	 * @param id - 문제집 ID
	 * @returns 성공 or 에러
	 */
	async incrementView(id: number): Promise<Result<void, CustomError>> {
		return this.docsRepo.incrementView(id);
	}
}
