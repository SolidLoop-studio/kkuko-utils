import { WordCommandService } from '@/src/lib/services/application/word/WordCommandService';
import type { IDocsLogWriter, IWordLogWriter, IUserContributionUpdater } from '@/src/lib/services/application/word/WordCommandService';
import type { IWordRepository } from '@/src/lib/services/domain/word/WordRepository';
import type { IWaitWordRepository } from '@/src/lib/services/domain/word/WaitWordRepository';
import type { IThemeRepository } from '@/src/lib/services/domain/word/ThemeRepository';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type { WordEntity, WordWithUser } from '@/src/lib/services/domain/word/WordEntity';
import type { WaitWordEntity, WaitWordWithUser } from '@/src/lib/services/domain/word/WaitWordEntity';
import type { ThemeEntity } from '@/src/lib/services/domain/word/ThemeEntity';

/** mock 객체 생성 헬퍼 */
function createMockWordRepo(): jest.Mocked<IWordRepository> {
    return {
        findByWord: jest.fn(),
        findByWords: jest.fn(),
        findByPrefix: jest.fn(),
        findAdvanced: jest.fn(),
        findRandomByFirstLetter: jest.fn(),
        findRandomByLastLetter: jest.fn(),
        findAllForCombiner: jest.fn(),
        findAll: jest.fn(),
        findLetterCounts: jest.fn(),
        findThemesByWordId: jest.fn(),
        save: jest.fn(),
        upsert: jest.fn(),
        deleteByWord: jest.fn(),
        deleteById: jest.fn(),
        deleteByIds: jest.fn(),
        findWordState: jest.fn(),
        findWordsCount: jest.fn(),
    };
}

function createMockWaitWordRepo(): jest.Mocked<IWaitWordRepository> {
    return {
        findByWord: jest.fn(),
        findAll: jest.fn(),
        findByPrefix: jest.fn(),
        save: jest.fn(),
        saveBulk: jest.fn(),
        deleteById: jest.fn(),
        deleteByIds: jest.fn(),
        deleteByWord: jest.fn(),
        deleteByWords: jest.fn(),
        findWaitWordsCount: jest.fn(),
    };
}

function createMockThemeRepo(): jest.Mocked<IThemeRepository> {
    return {
        findAll: jest.fn(),
        findByName: jest.fn(),
        findThemesByWordId: jest.fn(),
        findThemesByWordIds: jest.fn(),
        findWaitWordThemes: jest.fn(),
        findWaitWordThemesByIds: jest.fn(),
        saveWordThemes: jest.fn(),
        deleteWordThemes: jest.fn(),
        saveWaitWordThemes: jest.fn(),
        saveWordThemeRequests: jest.fn(),
        findWaitThemesByWordId: jest.fn(),
        findAllWaitThemes: jest.fn(),
        deleteWaitThemesByWordIds: jest.fn(),
    };
}

function createMockDocsLogWriter(): jest.Mocked<IDocsLogWriter> {
    return {
        writeDocsLog: jest.fn().mockResolvedValue(undefined),
        getAllDocs: jest.fn().mockResolvedValue([]),
        updateDocsLastUpdate: jest.fn().mockResolvedValue(undefined),
    };
}

function createMockWordLogWriter(): jest.Mocked<IWordLogWriter> {
    return {
        writeWordLog: jest.fn().mockResolvedValue(undefined),
    };
}

function createMockUserContributionUpdater(): jest.Mocked<IUserContributionUpdater> {
    return {
        incrementContribution: jest.fn().mockResolvedValue(undefined),
    };
}

/** 공통 mock 데이터 */
const mockWaitWord: WaitWordWithUser = {
    id: 1,
    word: '사과',
    requestType: 'add',
    status: 'pending',
    requestedBy: 'user1',
    requestedAt: '2025-01-01',
    wordId: null,
    userNickname: 'user1Nick',
};

const mockDeleteWaitWord: WaitWordWithUser = {
    id: 2,
    word: '바나나',
    requestType: 'delete',
    status: 'pending',
    requestedBy: 'user2',
    requestedAt: '2025-01-01',
    wordId: 100,
    userNickname: 'user2Nick',
};

const mockSavedWord: WordEntity = {
    id: 10,
    word: '사과',
    length: 2,
    firstLetter: '사',
    lastLetter: '과',
    noinCanuse: false,
    kCanuse: true,
    missionMark: 0,
    chosungs: 'ㅅㄱ',
    addedBy: 'user1',
    addedAt: '2025-01-01',
};

const mockOriginalWord: WordWithUser = {
    id: 100,
    word: '바나나',
    length: 3,
    firstLetter: '바',
    lastLetter: '나',
    noinCanuse: false,
    kCanuse: true,
    missionMark: 0,
    chosungs: 'ㅂㄴㄴ',
    addedBy: 'user3',
    addedAt: '2024-06-01',
    userNickname: 'user3Nick',
};

const mockThemeAnimal: ThemeEntity = { id: 10, name: '동물', code: 'ANI' };

describe('WordCommandService', () => {
    let wordRepo: jest.Mocked<IWordRepository>;
    let waitWordRepo: jest.Mocked<IWaitWordRepository>;
    let themeRepo: jest.Mocked<IThemeRepository>;
    let docsLogWriter: jest.Mocked<IDocsLogWriter>;
    let wordLogWriter: jest.Mocked<IWordLogWriter>;
    let userContributionUpdater: jest.Mocked<IUserContributionUpdater>;
    let service: WordCommandService;

    beforeEach(() => {
        wordRepo = createMockWordRepo();
        waitWordRepo = createMockWaitWordRepo();
        themeRepo = createMockThemeRepo();
        docsLogWriter = createMockDocsLogWriter();
        wordLogWriter = createMockWordLogWriter();
        userContributionUpdater = createMockUserContributionUpdater();
        service = new WordCommandService(
            wordRepo,
            waitWordRepo,
            themeRepo,
            docsLogWriter,
            wordLogWriter,
            userContributionUpdater,
        );
    });

    describe('acceptAddRequest', () => {
        it('추가 요청을 승인하면 전체 워크플로우가 실행된다', async () => {
            // 1. 대기 단어 조회
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));
            // 2. 대기 단어 테마 조회
            themeRepo.findWaitWordThemes.mockResolvedValue(
                success([{ themeId: 10, theme: mockThemeAnimal }])
            );
            // 3. 단어 저장
            wordRepo.save.mockResolvedValue(success([mockSavedWord]));
            // 4. 단어-테마 관계 저장
            themeRepo.saveWordThemes.mockResolvedValue(
                success([{ wordId: 10, word: '사과', themeId: 10, themeName: '동물' }])
            );
            // 8. 대기큐 삭제
            waitWordRepo.deleteByIds.mockResolvedValue(success(undefined));

            const result = await service.acceptAddRequest('사과', 'admin1');

            expect(result.success).toBe(true);
            // 워크플로우 검증
            expect(waitWordRepo.findByWord).toHaveBeenCalledWith('사과');
            expect(themeRepo.findWaitWordThemes).toHaveBeenCalledWith(1);
            expect(wordRepo.save).toHaveBeenCalledWith([
                expect.objectContaining({ word: '사과', addedBy: 'user1' }),
            ]);
            expect(themeRepo.saveWordThemes).toHaveBeenCalledWith([
                { wordId: 10, themeId: 10 },
            ]);
            expect(wordLogWriter.writeWordLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '사과', r_type: 'add', state: 'approved' }),
            ]);
            expect(userContributionUpdater.incrementContribution).toHaveBeenCalledWith('user1');
            expect(waitWordRepo.deleteByIds).toHaveBeenCalledWith([1]);
        });

        it('대기 단어가 없으면 에러를 반환한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.acceptAddRequest('없는단어', 'admin');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WaitWordNotFoundError');
            }
        });

        it('대기 단어 조회 실패 시 에러를 전파한다', async () => {
            const error = infrastructureError({ message: 'DB down' });
            waitWordRepo.findByWord.mockResolvedValue(failure(error));

            const result = await service.acceptAddRequest('사과', 'admin');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toBe('DB down');
            }
        });

        it('테마가 없으면 테마 저장을 건너뛴다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));
            themeRepo.findWaitWordThemes.mockResolvedValue(success([]));
            wordRepo.save.mockResolvedValue(success([mockSavedWord]));
            waitWordRepo.deleteByIds.mockResolvedValue(success(undefined));

            const result = await service.acceptAddRequest('사과', 'admin');

            expect(result.success).toBe(true);
            expect(themeRepo.saveWordThemes).not.toHaveBeenCalled();
        });

        it('requestedBy가 null이면 기여도 업데이트를 건너뛴다', async () => {
            const noUserWait: WaitWordWithUser = { ...mockWaitWord, requestedBy: null };
            waitWordRepo.findByWord.mockResolvedValue(success(noUserWait));
            themeRepo.findWaitWordThemes.mockResolvedValue(success([]));
            wordRepo.save.mockResolvedValue(success([mockSavedWord]));
            waitWordRepo.deleteByIds.mockResolvedValue(success(undefined));

            const result = await service.acceptAddRequest('사과', 'admin');

            expect(result.success).toBe(true);
            expect(userContributionUpdater.incrementContribution).not.toHaveBeenCalled();
        });
    });

    describe('rejectAddRequest', () => {
        it('추가 요청을 거부하면 대기큐 삭제 + 거부 로그를 기록한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));
            waitWordRepo.deleteByIds.mockResolvedValue(success(undefined));

            const result = await service.rejectAddRequest('사과', 'admin');

            expect(result.success).toBe(true);
            expect(waitWordRepo.deleteByIds).toHaveBeenCalledWith([1]);
            expect(wordLogWriter.writeWordLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '사과', r_type: 'add', state: 'rejected' }),
            ]);
        });

        it('대기 단어가 없으면 에러를 반환한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.rejectAddRequest('없는단어', 'admin');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WaitWordNotFoundError');
            }
        });
    });

    describe('acceptDeleteRequest', () => {
        it('삭제 요청을 승인하면 전체 워크플로우가 실행된다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockDeleteWaitWord));
            wordRepo.findByWord.mockResolvedValue(success(mockOriginalWord));
            wordRepo.findThemesByWordId.mockResolvedValue(success([
                { wordId: 100, word: mockOriginalWord, themes: { id: 10, name: '동물', code: 'ANI' } },
            ]));
            wordRepo.deleteByWord.mockResolvedValue(success([mockOriginalWord]));
            waitWordRepo.deleteById.mockResolvedValue(success(undefined));

            const result = await service.acceptDeleteRequest('바나나', 'admin');

            expect(result.success).toBe(true);
            expect(wordRepo.deleteByWord).toHaveBeenCalledWith('바나나');
            expect(waitWordRepo.deleteById).toHaveBeenCalledWith(2);
            expect(wordLogWriter.writeWordLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '바나나', r_type: 'delete', state: 'approved' }),
            ]);
            expect(userContributionUpdater.incrementContribution).toHaveBeenCalledWith('user2');
        });

        it('원본 단어가 없으면 에러를 반환한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockDeleteWaitWord));
            wordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.acceptDeleteRequest('바나나', 'admin');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WordNotFoundError');
            }
        });
    });

    describe('rejectDeleteRequest', () => {
        it('삭제 요청을 거부하면 대기큐 삭제 + 거부 로그를 기록한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockDeleteWaitWord));
            waitWordRepo.deleteById.mockResolvedValue(success(undefined));

            const result = await service.rejectDeleteRequest('바나나', 'admin');

            expect(result.success).toBe(true);
            expect(waitWordRepo.deleteById).toHaveBeenCalledWith(2);
            expect(wordLogWriter.writeWordLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '바나나', r_type: 'delete', state: 'rejected' }),
            ]);
        });
    });

    describe('deleteByAdmin', () => {
        it('관리자 즉시 삭제 워크플로우가 실행된다', async () => {
            wordRepo.findByWord.mockResolvedValue(success(mockOriginalWord));
            wordRepo.findThemesByWordId.mockResolvedValue(success([
                { wordId: 100, word: mockOriginalWord, themes: { id: 10, name: '동물', code: 'ANI' } },
            ]));
            wordRepo.deleteById.mockResolvedValue(success([mockOriginalWord]));

            const result = await service.deleteByAdmin('바나나', 'adminUser');

            expect(result.success).toBe(true);
            expect(wordLogWriter.writeWordLog).toHaveBeenCalledWith([
                expect.objectContaining({
                    word: '바나나',
                    make_by: 'adminUser',
                    processed_by: 'adminUser',
                    r_type: 'delete',
                    state: 'approved',
                }),
            ]);
            expect(userContributionUpdater.incrementContribution).toHaveBeenCalledWith('adminUser');
            expect(wordRepo.deleteById).toHaveBeenCalledWith(100);
        });

        it('단어가 없으면 에러를 반환한다', async () => {
            wordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.deleteByAdmin('없는단어', 'admin');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WordNotFoundError');
            }
        });
    });

    describe('requestDelete', () => {
        it('삭제 요청을 대기큐에 등록한다', async () => {
            wordRepo.findByWord.mockResolvedValue(success(mockOriginalWord));
            const mockSaved: WaitWordEntity = {
                id: 5,
                word: '바나나',
                requestType: 'delete',
                status: 'pending',
                requestedBy: 'user2',
                requestedAt: '2025-01-01',
                wordId: 100,
            };
            waitWordRepo.save.mockResolvedValue(success(mockSaved));

            const result = await service.requestDelete('바나나', 'user2');

            expect(result.success).toBe(true);
            expect(waitWordRepo.save).toHaveBeenCalledWith({
                word: '바나나',
                requestedBy: 'user2',
                requestType: 'delete',
                wordId: 100,
            });
        });

        it('원본 단어가 없으면 에러를 반환한다', async () => {
            wordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.requestDelete('없는단어', 'user1');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WordNotFoundError');
            }
        });
    });

    describe('cancelRequest', () => {
        it('대기큐에서 요청을 삭제한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));
            waitWordRepo.deleteById.mockResolvedValue(success(undefined));

            const result = await service.cancelRequest('사과');

            expect(result.success).toBe(true);
            expect(waitWordRepo.deleteById).toHaveBeenCalledWith(1);
        });

        it('대기 단어가 없으면 에러를 반환한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(null));

            const result = await service.cancelRequest('없는단어');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('WaitWordNotFoundError');
            }
        });
    });

    describe('addWord', () => {
        it('대기큐에 단어와 테마를 등록한다', async () => {
            const mockSaved: WaitWordEntity = {
                id: 5,
                word: '포도',
                requestType: 'add',
                status: 'pending',
                requestedBy: 'user1',
                requestedAt: '2025-01-01',
                wordId: null,
            };
            waitWordRepo.save.mockResolvedValue(success(mockSaved));
            themeRepo.saveWaitWordThemes.mockResolvedValue(success(undefined));

            const result = await service.addWord('포도', [10, 20], 'user1');

            expect(result.success).toBe(true);
            expect(waitWordRepo.save).toHaveBeenCalledWith({
                word: '포도',
                requestedBy: 'user1',
                requestType: 'add',
            });
            expect(themeRepo.saveWaitWordThemes).toHaveBeenCalledWith([
                { waitWordId: 5, themeId: 10 },
                { waitWordId: 5, themeId: 20 },
            ]);
        });

        it('테마가 비어있으면 테마 저장을 건너뛴다', async () => {
            const mockSaved: WaitWordEntity = {
                id: 5,
                word: '포도',
                requestType: 'add',
                status: 'pending',
                requestedBy: 'user1',
                requestedAt: '2025-01-01',
                wordId: null,
            };
            waitWordRepo.save.mockResolvedValue(success(mockSaved));

            const result = await service.addWord('포도', [], 'user1');

            expect(result.success).toBe(true);
            expect(themeRepo.saveWaitWordThemes).not.toHaveBeenCalled();
        });

        it('save 결과가 null이면 에러를 반환한다', async () => {
            waitWordRepo.save.mockResolvedValue(success(null));

            const result = await service.addWord('포도', [], 'user1');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.name).toBe('ValidationError');
            }
        });
    });

    describe('addWordsBulk', () => {
        it('여러 단어를 대량 등록한다', async () => {
            const savedWords: WaitWordEntity[] = [
                { id: 1, word: 'A', requestType: 'add', status: 'pending', requestedBy: null, requestedAt: '2025-01-01', wordId: null },
                { id: 2, word: 'B', requestType: 'add', status: 'pending', requestedBy: null, requestedAt: '2025-01-01', wordId: null },
            ];
            waitWordRepo.saveBulk.mockResolvedValue(success(savedWords));

            const result = await service.addWordsBulk(['A', 'B'], null);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.addedCount).toBe(2);
            }
            expect(waitWordRepo.saveBulk).toHaveBeenCalledWith([
                { word: 'A', requestedBy: null, requestType: 'add' },
                { word: 'B', requestedBy: null, requestType: 'add' },
            ]);
        });
    });

    describe('requestWordThemes', () => {
        it('themeRepo.saveWordThemeRequests를 호출한다', async () => {
            themeRepo.saveWordThemeRequests.mockResolvedValue(
                success([{ themeName: '동물', typez: 'add' as const }])
            );

            const result = await service.requestWordThemes([
                { wordId: 1, themeId: 10, typez: 'add', reqBy: 'user1' },
            ]);

            expect(result.success).toBe(true);
            expect(themeRepo.saveWordThemeRequests).toHaveBeenCalled();
        });
    });

    describe('processDocsForWord (내부 로직 통합 확인)', () => {
        it('acceptAddRequest에서 문서 매칭 후 로그를 기록한다', async () => {
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));
            themeRepo.findWaitWordThemes.mockResolvedValue(
                success([{ themeId: 10, theme: mockThemeAnimal }])
            );
            wordRepo.save.mockResolvedValue(success([mockSavedWord]));
            themeRepo.saveWordThemes.mockResolvedValue(success([]));
            waitWordRepo.deleteByIds.mockResolvedValue(success(undefined));

            // 문서 데이터 - '과'에 매칭되는 글자문서 + '동물'에 매칭되는 테마문서
            docsLogWriter.getAllDocs.mockResolvedValue([
                { id: 1, name: '과', typez: 'letter' },
                { id: 2, name: '동물', typez: 'theme' },
                { id: 3, name: '식물', typez: 'theme' },
            ]);

            await service.acceptAddRequest('사과', 'admin');

            // 글자 문서 로그 ('사과'의 마지막 글자 '과' 매칭)
            expect(docsLogWriter.writeDocsLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '사과', docs_id: 1, type: 'add' }),
            ]);
            // 테마 문서 로그 ('동물' 매칭)
            expect(docsLogWriter.writeDocsLog).toHaveBeenCalledWith([
                expect.objectContaining({ word: '사과', docs_id: 2, type: 'add' }),
            ]);
            // 테마 문서 업데이트
            expect(docsLogWriter.updateDocsLastUpdate).toHaveBeenCalledWith([2]);
        });
    });
});
