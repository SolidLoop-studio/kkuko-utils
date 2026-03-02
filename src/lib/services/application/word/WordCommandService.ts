import type { IWordRepository } from '../../domain/word/WordRepository';
import type { IWaitWordRepository } from '../../domain/word/WaitWordRepository';
import type { IThemeRepository } from '../../domain/word/ThemeRepository';
import type { CustomError } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { WaitWordEntity } from '../../domain/word/WaitWordEntity';
import { WordDomainService } from '../../domain/word/WordDomainService';
import { success, failure } from '../../domain/result';
import { waitWordNotFoundError, wordNotFoundError, validationError } from '../../domain/errors';

/**
 * Docs 로그를 기록하기 위한 인터페이스 (SoC: Docs 도메인 의존성 최소화)
 */
export interface IDocsLogWriter {
    /** 문서 로그를 기록합니다. */
    writeDocsLog(logsData: { word: string; docs_id: number; add_by: string | null; type: 'add' | 'delete' }[]): Promise<void>;
    /** 전체 문서 목록을 조회합니다. */
    getAllDocs(): Promise<{ id: number; name: string; typez: string }[]>;
    /** 문서 마지막 업데이트를 갱신합니다. */
    updateDocsLastUpdate(docsIds: number[]): Promise<void>;
}

/**
 * Word 로그를 기록하기 위한 인터페이스
 */
export interface IWordLogWriter {
    /** 단어 로그를 기록합니다. */
    writeWordLog(logsData: { word: string; make_by: string | null; processed_by: string | null; r_type: 'add' | 'delete'; state: 'approved' | 'rejected' }[]): Promise<void>;
}

/**
 * 유저 기여도를 업데이트하기 위한 인터페이스
 */
export interface IUserContributionUpdater {
    /** 유저 기여도를 증가시킵니다. */
    incrementContribution(userId: string, amount?: number): Promise<void>;
}

/**
 * Word 명령 서비스 (Application Layer)
 *
 * 단어 추가/삭제 워크플로우를 오케스트레이션합니다.
 * 현재 TableWorkFunc.tsx에 분산된 다단계 워크플로우를 Application Service로 집중합니다.
 */
export class WordCommandService {
    private readonly domainService: WordDomainService;

    constructor(
        private readonly wordRepo: IWordRepository,
        private readonly waitWordRepo: IWaitWordRepository,
        private readonly themeRepo: IThemeRepository,
        private readonly docsLogWriter: IDocsLogWriter,
        private readonly wordLogWriter: IWordLogWriter,
        private readonly userContributionUpdater: IUserContributionUpdater,
    ) {
        this.domainService = new WordDomainService();
    }

    /**
     * 추가 요청을 승인합니다.
     *
     * 워크플로우:
     * 1. 대기 단어 정보 조회
     * 2. 대기 단어의 테마 정보 조회
     * 3. 노인정 판별 → 단어 데이터 추가
     * 4. 단어-테마 관계 추가
     * 5. 단어 추가 로그 등록
     * 6. 문서 매칭 → 문서 로그 + 업데이트
     * 7. 유저 기여도 증가
     * 8. 대기큐에서 삭제
     *
     * @param word - 승인할 단어 문자열
     * @param processedBy - 처리한 관리자 ID (nullable)
     * @returns 성공 or 에러
     */
    async acceptAddRequest(word: string, processedBy: string | null): Promise<Result<void, CustomError>> {
        // 1. 대기 단어 정보 조회
        const waitWordResult = await this.waitWordRepo.findByWord(word);
        if (!waitWordResult.success) return waitWordResult;
        if (!waitWordResult.data) return failure(waitWordNotFoundError(word));

        const waitWord = waitWordResult.data;

        // 2. 대기 단어의 테마 정보 조회
        const themesResult = await this.themeRepo.findWaitWordThemes(waitWord.id);
        if (!themesResult.success) return themesResult;

        const themes = themesResult.data;

        // 3. 노인정 판별 → 단어 데이터 추가
        const isNoinWord = this.domainService.isNoinWord(
            themes.map(({ theme }) => theme.code)
        );

        const saveResult = await this.wordRepo.save([{
            word: waitWord.word,
            noinCanuse: isNoinWord,
            addedBy: waitWord.requestedBy,
        }]);
        if (!saveResult.success) return saveResult;

        const savedWord = saveResult.data[0];
        if (!savedWord) return failure(validationError('단어 추가에 실패했습니다.'));

        // 4. 단어-테마 관계 추가
        if (themes.length > 0) {
            const themeResult = await this.themeRepo.saveWordThemes(
                themes.map(({ themeId }) => ({
                    wordId: savedWord.id,
                    themeId,
                }))
            );
            if (!themeResult.success) return themeResult;
        }

        // 5. 단어 추가 로그 등록
        await this.wordLogWriter.writeWordLog([{
            word: waitWord.word,
            make_by: waitWord.requestedBy,
            processed_by: processedBy,
            r_type: 'add',
            state: 'approved',
        }]);

        // 6. 문서 매칭 → 문서 로그 + 업데이트
        await this.processDocsForWord(
            waitWord.word,
            themes.map(({ theme }) => theme.name),
            waitWord.requestedBy,
            'add'
        );

        // 7. 유저 기여도 증가
        if (waitWord.requestedBy) {
            await this.userContributionUpdater.incrementContribution(waitWord.requestedBy);
        }

        // 8. 대기큐에서 삭제
        const deleteResult = await this.waitWordRepo.deleteByIds([waitWord.id]);
        if (!deleteResult.success) return deleteResult;

        return success(undefined);
    }

    /**
     * 추가 요청을 거부합니다.
     *
     * 워크플로우:
     * 1. 대기 단어 정보 조회
     * 2. 대기큐에서 삭제
     * 3. 거부 로그 등록
     *
     * @param word - 거부할 단어 문자열
     * @param processedBy - 처리한 관리자 ID (nullable)
     */
    async rejectAddRequest(word: string, processedBy: string | null): Promise<Result<void, CustomError>> {
        const waitWordResult = await this.waitWordRepo.findByWord(word);
        if (!waitWordResult.success) return waitWordResult;
        if (!waitWordResult.data) return failure(waitWordNotFoundError(word));

        const waitWord = waitWordResult.data;

        const deleteResult = await this.waitWordRepo.deleteByIds([waitWord.id]);
        if (!deleteResult.success) return deleteResult;

        await this.wordLogWriter.writeWordLog([{
            word: waitWord.word,
            make_by: waitWord.requestedBy,
            processed_by: processedBy,
            r_type: 'add',
            state: 'rejected',
        }]);

        return success(undefined);
    }

    /**
     * 삭제 요청을 승인합니다.
     *
     * 워크플로우:
     * 1. 대기 단어 정보 조회
     * 2. 원본 단어 + 테마 정보 조회
     * 3. words 테이블에서 삭제
     * 4. 대기큐에서 삭제
     * 5. 승인 로그 등록
     * 6. 문서 매칭 → 문서 로그 + 업데이트
     * 7. 유저 기여도 증가
     *
     * @param word - 승인할 삭제 요청 단어 문자열
     * @param processedBy - 처리한 관리자 ID (nullable)
     */
    async acceptDeleteRequest(word: string, processedBy: string | null): Promise<Result<void, CustomError>> {
        // 1. 대기 단어 정보 조회
        const waitWordResult = await this.waitWordRepo.findByWord(word);
        if (!waitWordResult.success) return waitWordResult;
        if (!waitWordResult.data) return failure(waitWordNotFoundError(word));

        const waitWord = waitWordResult.data;

        // 2. 원본 단어 + 테마 정보 조회
        const wordResult = await this.wordRepo.findByWord(word);
        if (!wordResult.success) return wordResult;
        if (!wordResult.data) return failure(wordNotFoundError(word));

        const originalWord = wordResult.data;

        const themesResult = await this.wordRepo.findThemesByWordId(originalWord.id);
        if (!themesResult.success) return themesResult;

        const themeNames = themesResult.data.map((t) => t.themes.name);

        // 3. words 테이블에서 삭제
        const deleteWordResult = await this.wordRepo.deleteByWord(waitWord.word);
        if (!deleteWordResult.success) return deleteWordResult;

        // 4. 대기큐에서 삭제
        const deleteWaitResult = await this.waitWordRepo.deleteById(waitWord.id);
        if (!deleteWaitResult.success) return deleteWaitResult;

        // 5. 승인 로그 등록
        await this.wordLogWriter.writeWordLog([{
            word: waitWord.word,
            make_by: waitWord.requestedBy,
            processed_by: processedBy,
            r_type: 'delete',
            state: 'approved',
        }]);

        // 6. 문서 매칭 → 문서 로그 + 업데이트
        await this.processDocsForWord(
            waitWord.word,
            themeNames,
            waitWord.requestedBy,
            'delete'
        );

        // 7. 유저 기여도 증가
        if (waitWord.requestedBy) {
            await this.userContributionUpdater.incrementContribution(waitWord.requestedBy);
        }

        return success(undefined);
    }

    /**
     * 삭제 요청을 거부합니다.
     *
     * 워크플로우:
     * 1. 대기 단어 정보 조회
     * 2. 대기큐에서 삭제
     * 3. 거부 로그 등록
     *
     * @param word - 거부할 삭제 요청 단어 문자열
     * @param processedBy - 처리한 관리자 ID (nullable)
     */
    async rejectDeleteRequest(word: string, processedBy: string | null): Promise<Result<void, CustomError>> {
        const waitWordResult = await this.waitWordRepo.findByWord(word);
        if (!waitWordResult.success) return waitWordResult;
        if (!waitWordResult.data) return failure(waitWordNotFoundError(word));

        const waitWord = waitWordResult.data;

        const deleteResult = await this.waitWordRepo.deleteById(waitWord.id);
        if (!deleteResult.success) return deleteResult;

        await this.wordLogWriter.writeWordLog([{
            word: waitWord.word,
            make_by: waitWord.requestedBy,
            processed_by: processedBy,
            r_type: 'delete',
            state: 'rejected',
        }]);

        return success(undefined);
    }

    /**
     * 관리자가 단어를 즉시 삭제합니다.
     *
     * 워크플로우:
     * 1. 단어 정보 + 테마 조회
     * 2. 삭제 로그 등록
     * 3. 문서 매칭 → 문서 로그 + 업데이트
     * 4. 유저 기여도 증가
     * 5. 단어 삭제
     *
     * @param word - 삭제할 단어 문자열
     * @param processedBy - 관리자 사용자 ID
     */
    async deleteByAdmin(word: string, processedBy: string): Promise<Result<void, CustomError>> {
        // 1. 단어 정보 + 테마 조회
        const wordResult = await this.wordRepo.findByWord(word);
        if (!wordResult.success) return wordResult;
        if (!wordResult.data) return failure(wordNotFoundError(word));

        const targetWord = wordResult.data;

        const themesResult = await this.wordRepo.findThemesByWordId(targetWord.id);
        if (!themesResult.success) return themesResult;

        const themeNames = themesResult.data.map((t) => t.themes.name);

        // 2. 삭제 로그 등록
        await this.wordLogWriter.writeWordLog([{
            word,
            make_by: processedBy,
            processed_by: processedBy,
            r_type: 'delete',
            state: 'approved',
        }]);

        // 3. 문서 매칭 → 문서 로그 + 업데이트
        await this.processDocsForWord(word, themeNames, processedBy, 'delete');

        // 4. 유저 기여도 증가
        await this.userContributionUpdater.incrementContribution(processedBy);

        // 5. 단어 삭제
        const deleteResult = await this.wordRepo.deleteById(targetWord.id);
        if (!deleteResult.success) return deleteResult;

        return success(undefined);
    }

    /**
     * 삭제 요청을 등록합니다.
     *
     * 워크플로우:
     * 1. 원본 단어 정보 조회
     * 2. 대기큐에 삭제 요청 등록
     *
     * @param word - 삭제 요청할 단어 문자열
     * @param requestedBy - 요청한 사용자 ID (nullable)
     */
    async requestDelete(word: string, requestedBy: string | null): Promise<Result<WaitWordEntity | null, CustomError>> {
        const wordResult = await this.wordRepo.findByWord(word);
        if (!wordResult.success) return wordResult as Result<WaitWordEntity | null, CustomError>;
        if (!wordResult.data) return failure(wordNotFoundError(word));

        const saveResult = await this.waitWordRepo.save({
            word,
            requestedBy,
            requestType: 'delete',
            wordId: wordResult.data.id,
        });

        return saveResult;
    }

    /**
     * 추가 / 삭제 요청을 취소합니다. (대기큐에서 삭제)
     *
     * @param word - 취소할 단어 문자열
     */
    async cancelRequest(word: string): Promise<Result<void, CustomError>> {
        const waitWordResult = await this.waitWordRepo.findByWord(word);
        if (!waitWordResult.success) return waitWordResult;
        if (!waitWordResult.data) return failure(waitWordNotFoundError(word));

        return this.waitWordRepo.deleteById(waitWordResult.data.id);
    }

    /**
     * 단어를 추가 요청합니다. (대기큐에 등록 + 테마 연결)
     *
     * @param word - 추가할 단어 문자열
     * @param themeIds - 테마 ID 배열
     * @param addedBy - 요청한 사용자 ID (nullable)
     */
    async addWord(word: string, themeIds: number[], addedBy: string | null): Promise<Result<void, CustomError>> {
        const saveResult = await this.waitWordRepo.save({
            word,
            requestedBy: addedBy,
            requestType: 'add',
        });
        if (!saveResult.success) return saveResult;
        if (!saveResult.data) return failure(validationError('대기 단어 추가에 실패했습니다.'));

        if (themeIds.length > 0) {
            const themeResult = await this.themeRepo.saveWaitWordThemes(
                themeIds.map((themeId) => ({
                    waitWordId: saveResult.data!.id,
                    themeId,
                }))
            );
            if (!themeResult.success) return themeResult;
        }

        return success(undefined);
    }

    /**
     * 단어를 대량 추가 요청합니다. (대기큐에 일괄 등록)
     *
     * @param words - 추가할 단어 문자열 배열
     * @param addedBy - 요청한 사용자 ID (nullable)
     * @returns 추가된 대기 단어 수
     */
    async addWordsBulk(
        words: string[],
        addedBy: string | null
    ): Promise<Result<{ addedCount: number }, CustomError>> {
        const data = words.map((word) => ({
            word,
            requestedBy: addedBy,
            requestType: 'add' as const,
        }));

        const result = await this.waitWordRepo.saveBulk(data);
        if (!result.success) return result;

        return success({ addedCount: result.data.length });
    }

    /**
     * 단어-테마 관계를 요청합니다. (word_themes_wait에 추가)
     *
     * @param requests - 테마 요청 데이터 배열
     */
    async requestWordThemes(requests: { wordId: number; themeId: number; typez: 'add' | 'delete'; reqBy: string | null }[]): Promise<Result<{ themeName: string; typez: 'add' | 'delete' }[], CustomError>> {
        return this.themeRepo.saveWordThemeRequests(requests);
    }

    /**
     * 문서 매칭 후 로그를 기록하고 업데이트하는 내부 유틸리티
     *
     * @param word - 단어 문자열
     * @param themeNames - 매칭할 테마 이름 배열
     * @param addBy - 사용자 ID
     * @param type - 로그 타입 (add / delete)
     */
    private async processDocsForWord(
        word: string,
        themeNames: string[],
        addBy: string | null,
        type: 'add' | 'delete'
    ): Promise<void> {
        const allDocs = await this.docsLogWriter.getAllDocs();
        const { letterDocs, themeDocs } = this.domainService.matchDocsForWord(
            word,
            themeNames,
            allDocs
        );

        const letterDocsLogs = letterDocs.map((d) => ({
            word,
            docs_id: d.id,
            add_by: addBy,
            type,
        }));

        const themeDocsLogs = themeDocs.map((d) => ({
            word,
            docs_id: d.id,
            add_by: addBy,
            type,
        }));

        if (letterDocsLogs.length > 0) {
            await this.docsLogWriter.writeDocsLog(letterDocsLogs);
        }

        if (themeDocsLogs.length > 0) {
            await this.docsLogWriter.writeDocsLog(themeDocsLogs);
        }

        const themeDocsIds = themeDocs.map((d) => d.id);
        if (themeDocsIds.length > 0) {
            await this.docsLogWriter.updateDocsLastUpdate(themeDocsIds);
        }
    }
}
