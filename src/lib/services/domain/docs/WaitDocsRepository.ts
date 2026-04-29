import type { Result } from '../result';
import type { CustomError } from '../result';
import type { WaitDocsWithUser } from './DocsEntity';

/**
 * WaitDocs Repository 인터페이스 (Port)
 *
 * 대기 중인 문제집 요청에 대한 데이터 접근 추상화 레이어입니다.
 * 인프라 구현체(Supabase 등)와 도메인을 분리합니다.
 */
export interface IWaitDocsRepository {
    /**
     * 모든 대기 중인 문제집 요청을 조회합니다.
     *
     * @returns 사용자 정보가 포함된 대기 요청 배열
     */
    findAll(): Promise<Result<WaitDocsWithUser[], CustomError>>;

    /**
     * 새로운 문제집 요청을 저장합니다.
     *
     * @param docsName - 요청한 문제집 이름
     * @param reqBy - 요청자 ID
     * @returns void
     */
    save(docsName: string, reqBy: string | null): Promise<Result<void, CustomError>>;

    /**
     * ID로 대기 중인 문제집 요청을 삭제합니다.
     *
     * @param ids - 삭제할 요청 ID 배열
     * @returns void
     */
    deleteByIds(ids: number[]): Promise<Result<void, CustomError>>;
}
