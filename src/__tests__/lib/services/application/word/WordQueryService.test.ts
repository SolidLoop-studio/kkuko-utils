import { WordQueryService } from '@/src/lib/services/application/word/WordQueryService';
import type { IWordRepository } from '@/src/lib/services/domain/word/WordRepository';
import type { IWaitWordRepository } from '@/src/lib/services/domain/word/WaitWordRepository';
import type { IThemeRepository } from '@/src/lib/services/domain/word/ThemeRepository';
import type { CustomError } from '@/src/lib/services/domain/result';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';
import type { LetterCountInfo, WordWithUser, WordListItem } from '@/src/lib/services/domain/word/WordEntity';
import type { WaitWordWithUser } from '@/src/lib/services/domain/word/WaitWordEntity';
import type { ThemeEntity, WordThemeMapping, WaitThemeInfo } from '@/src/lib/services/domain/word/ThemeEntity';
import type { advancedQueryType } from '@/src/app/types/type';

/** mock repository 생성 헬퍼 */
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

describe('WordQueryService', () => {
    let wordRepo: jest.Mocked<IWordRepository>;
    let waitWordRepo: jest.Mocked<IWaitWordRepository>;
    let themeRepo: jest.Mocked<IThemeRepository>;
    let service: WordQueryService;

    beforeEach(() => {
        jest.useFakeTimers();
        wordRepo = createMockWordRepo();
        waitWordRepo = createMockWaitWordRepo();
        themeRepo = createMockThemeRepo();
        service = new WordQueryService(wordRepo, waitWordRepo, themeRepo);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('searchByPrefix', () => {
        it('words + waitWords를 합산하여 중복 제거 후 길이순 정렬한다', async () => {
            wordRepo.findByPrefix.mockResolvedValue(success(['사과', '사람']));
            waitWordRepo.findByPrefix.mockResolvedValue(success(['사과나무', '사과']));

            const promise = service.searchByPrefix('사');
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(true);
            if (result.success) {
                // '사과'는 중복 제거, 길이순 정렬
                expect(result.data).toEqual(['사과', '사람', '사과나무']);
            }
        });

        it('wordRepo 에러 시 에러를 반환한다', async () => {
            const error = infrastructureError({ message: 'DB error' });
            wordRepo.findByPrefix.mockResolvedValue(failure(error));

            const promise = service.searchByPrefix('사');
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toBe('DB error');
            }
        });

        it('waitWordRepo 에러 시 에러를 반환한다', async () => {
            wordRepo.findByPrefix.mockResolvedValue(success(['사과']));
            const error = infrastructureError({ message: 'wait DB error' });
            waitWordRepo.findByPrefix.mockResolvedValue(failure(error));

            const promise = service.searchByPrefix('사');
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(false);
        });
    });

    describe('searchAdvanced', () => {
        const letterCounts: LetterCountInfo = {
            firstLetterCounts: {
                '지': { count: 10, kCount: 8, nCount: 10, len3KCount: 3, len3NCount: 5 },
            },
            lastLetterCounts: {
                '가': { count: 5, kCount: 4, nCount: 5 },
            },
        };

        const korStartInput: advancedQueryType = {
            mode: 'kor-start',
            limit: 10,
            start: '가',
            ingjung: false,
            mission: '',
            man: false,
            jen: false,
            eti: false,
            duem: false,
            miniInfo: false,
        };

        it('kor-start 모드에서 마지막 글자 기준 nextWordCount를 계산한다', async () => {
            wordRepo.findLetterCounts.mockResolvedValue(success(letterCounts));
            wordRepo.findAdvanced.mockResolvedValue(success([{ word: '가지' }]));

            const promise = service.searchAdvanced(korStartInput);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual([
                    { word: '가지', nextWordCount: 10 },
                ]);
            }
        });

        it('kor-end 모드에서 첫 글자 기준 nextWordCount를 계산한다', async () => {
            wordRepo.findLetterCounts.mockResolvedValue(success(letterCounts));
            wordRepo.findAdvanced.mockResolvedValue(success([{ word: '가지' }]));

            const input: advancedQueryType = {
                ...korStartInput,
                mode: 'kor-end',
            };

            const promise = service.searchAdvanced(input);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(true);
            if (result.success) {
                // 첫 글자 '가'의 lastLetterCounts.nCount = 5
                expect(result.data).toEqual([
                    { word: '가지', nextWordCount: 5 },
                ]);
            }
        });

        it('kung 모드에서 len3 카운트를 사용한다', async () => {
            wordRepo.findLetterCounts.mockResolvedValue(success(letterCounts));
            wordRepo.findAdvanced.mockResolvedValue(success([{ word: '가지' }]));

            const input: advancedQueryType = {
                ...korStartInput,
                mode: 'kung',
            };

            const promise = service.searchAdvanced(input);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(true);
            if (result.success) {
                // 마지막 글자 '지'의 firstLetterCounts.len3NCount = 5
                expect(result.data).toEqual([
                    { word: '가지', nextWordCount: 5 },
                ]);
            }
        });

        it('hunmin 모드에서 nextWordCount를 -1로 반환한다', async () => {
            wordRepo.findLetterCounts.mockResolvedValue(success(letterCounts));
            wordRepo.findAdvanced.mockResolvedValue(success([{ word: '가지' }]));

            const input: advancedQueryType = {
                mode: 'hunmin',
                limit: 10,
                query: '가',
                mission: '',
            };

            const promise = service.searchAdvanced(input);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual([
                    { word: '가지', nextWordCount: -1 },
                ]);
            }
        });

        it('letterCounts 조회 실패 시 에러를 반환한다', async () => {
            const error = infrastructureError({ message: 'DB error' });
            wordRepo.findLetterCounts.mockResolvedValue(failure(error));

            const promise = service.searchAdvanced(korStartInput);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(false);
        });

        it('findAdvanced 실패 시 에러를 반환한다', async () => {
            wordRepo.findLetterCounts.mockResolvedValue(success(letterCounts));
            const error = infrastructureError({ message: 'query error' });
            wordRepo.findAdvanced.mockResolvedValue(failure(error));

            const promise = service.searchAdvanced(korStartInput);
            jest.advanceTimersByTime(2000);
            const result = await promise;

            expect(result.success).toBe(false);
        });
    });

    describe('getWordInfo', () => {
        it('wordRepo.findByWord를 호출한다', async () => {
            const mockWord: WordWithUser = {
                id: 1,
                word: '사과',
                length: 2,
                firstLetter: '사',
                lastLetter: '과',
                noinCanuse: false,
                kCanuse: true,
                missionMark: 0,
                chosungs: 'ㅅㄱ',
                addedBy: null,
                addedAt: '2025-01-01',
                userNickname: null,
            };
            wordRepo.findByWord.mockResolvedValue(success(mockWord));

            const result = await service.getWordInfo('사과');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data?.word).toBe('사과');
            }
            expect(wordRepo.findByWord).toHaveBeenCalledWith('사과');
        });
    });

    describe('getWaitWordInfo', () => {
        it('waitWordRepo.findByWord를 호출한다', async () => {
            const mockWaitWord: WaitWordWithUser = {
                id: 1,
                word: '포도',
                requestType: 'add',
                status: 'pending',
                requestedBy: 'user1',
                requestedAt: '2025-01-01',
                wordId: null,
                userNickname: 'user1Nick',
            };
            waitWordRepo.findByWord.mockResolvedValue(success(mockWaitWord));

            const result = await service.getWaitWordInfo('포도');

            expect(result.success).toBe(true);
            expect(waitWordRepo.findByWord).toHaveBeenCalledWith('포도');
        });
    });

    describe('getWordThemes', () => {
        it('themeRepo.findThemesByWordId를 호출한다', async () => {
            const mockThemes: WordThemeMapping[] = [
                { wordId: 1, themeId: 10, themeName: '동물', themeCode: 'ANI' },
            ];
            themeRepo.findThemesByWordId.mockResolvedValue(success(mockThemes));

            const result = await service.getWordThemes(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].themeName).toBe('동물');
            }
        });
    });

    describe('getWaitWordThemes', () => {
        it('themeRepo.findWaitWordThemes를 호출한다', async () => {
            const mockThemes: { themeId: number; theme: ThemeEntity }[] = [
                { themeId: 10, theme: { id: 10, name: '동물', code: 'ANI' } },
            ];
            themeRepo.findWaitWordThemes.mockResolvedValue(success(mockThemes));

            const result = await service.getWaitWordThemes(1);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data[0].theme.name).toBe('동물');
            }
        });
    });

    describe('getRandomWord', () => {
        it('first 기준이면 findRandomByFirstLetter를 호출한다', async () => {
            wordRepo.findRandomByFirstLetter.mockResolvedValue(success('가지'));

            const result = await service.getRandomWord({
                by: 'first',
                letters: ['가'],
            });

            expect(result.success).toBe(true);
            expect(wordRepo.findRandomByFirstLetter).toHaveBeenCalledWith(['가']);
            expect(wordRepo.findRandomByLastLetter).not.toHaveBeenCalled();
        });

        it('last 기준이면 findRandomByLastLetter를 호출한다', async () => {
            wordRepo.findRandomByLastLetter.mockResolvedValue(success('나무'));

            const result = await service.getRandomWord({
                by: 'last',
                letters: ['무'],
            });

            expect(result.success).toBe(true);
            expect(wordRepo.findRandomByLastLetter).toHaveBeenCalledWith(['무']);
        });
    });

    describe('getLetterCounts', () => {
        it('wordRepo.findLetterCounts를 직접 호출한다', async () => {
            const mockData: LetterCountInfo = {
                firstLetterCounts: {},
                lastLetterCounts: {},
            };
            wordRepo.findLetterCounts.mockResolvedValue(success(mockData));

            const result = await service.getLetterCounts();

            expect(result.success).toBe(true);
            expect(wordRepo.findLetterCounts).toHaveBeenCalledTimes(1);
        });
    });

    describe('getAllForCombiner', () => {
        it('wordRepo.findAllForCombiner를 직접 호출한다', async () => {
            const mockItems: WordListItem[] = [
                { word: '사과', noinCanuse: false, kCanuse: true, status: 'ok' },
            ];
            wordRepo.findAllForCombiner.mockResolvedValue(success(mockItems));

            const result = await service.getAllForCombiner();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
            }
        });
    });

    describe('getAllForDownload', () => {
        it('wordRepo.findAll에 필터를 전달한다', async () => {
            const mockItems: WordListItem[] = [];
            wordRepo.findAll.mockResolvedValue(success(mockItems));

            const filter = {
                includeAddReq: true,
                includeDeleteReq: false,
                includeInjung: true,
                includeNoInjung: false,
                onlyWordChain: false,
            };

            await service.getAllForDownload(filter);

            expect(wordRepo.findAll).toHaveBeenCalledWith(filter);
        });
    });

    describe('getWordsCount / getWaitWordsCount', () => {
        it('단어 수를 조회한다', async () => {
            wordRepo.findWordsCount.mockResolvedValue(success(1000));

            const result = await service.getWordsCount();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(1000);
            }
        });

        it('대기 단어 수를 조회한다', async () => {
            waitWordRepo.findWaitWordsCount.mockResolvedValue(success(50));

            const result = await service.getWaitWordsCount();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(50);
            }
        });
    });

    describe('getAllThemes', () => {
        it('themeRepo.findAll을 호출한다', async () => {
            const mockThemes: ThemeEntity[] = [
                { id: 1, name: '동물', code: 'ANI' },
                { id: 2, name: '식물', code: 'PLT' },
            ];
            themeRepo.findAll.mockResolvedValue(success(mockThemes));

            const result = await service.getAllThemes();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(2);
            }
        });
    });

    describe('getAllWaitWords', () => {
        it('필터 없이 전체 대기 단어를 조회한다', async () => {
            waitWordRepo.findAll.mockResolvedValue(success([]));

            await service.getAllWaitWords();

            expect(waitWordRepo.findAll).toHaveBeenCalledWith(undefined);
        });

        it('필터를 전달하여 조회한다', async () => {
            waitWordRepo.findAll.mockResolvedValue(success([]));

            await service.getAllWaitWords('add');

            expect(waitWordRepo.findAll).toHaveBeenCalledWith('add');
        });
    });

    describe('getAllWaitThemes', () => {
        it('themeRepo.findAllWaitThemes를 호출한다', async () => {
            const mockData: WaitThemeInfo[] = [];
            themeRepo.findAllWaitThemes.mockResolvedValue(success(mockData));

            await service.getAllWaitThemes('delete');

            expect(themeRepo.findAllWaitThemes).toHaveBeenCalledWith('delete');
        });
    });

    describe('getWaitThemesByWordId', () => {
        it('themeRepo.findWaitThemesByWordId를 호출한다', async () => {
            themeRepo.findWaitThemesByWordId.mockResolvedValue(success([]));

            await service.getWaitThemesByWordId(42);

            expect(themeRepo.findWaitThemesByWordId).toHaveBeenCalledWith(42);
        });
    });

    describe('getThemesByWordIds', () => {
        it('themeRepo.findThemesByWordIds를 호출한다', async () => {
            themeRepo.findThemesByWordIds.mockResolvedValue(success([]));

            await service.getThemesByWordIds([1, 2, 3]);

            expect(themeRepo.findThemesByWordIds).toHaveBeenCalledWith([1, 2, 3]);
        });
    });

    describe('getWordState', () => {
        it('wordRepo.findWordState를 호출한다', async () => {
            wordRepo.findWordState.mockResolvedValue(success({
                firstLetterCounts: [],
                lastLetterCounts: [],
            }));

            const result = await service.getWordState();

            expect(result.success).toBe(true);
            expect(wordRepo.findWordState).toHaveBeenCalled();
        });
    });
});
