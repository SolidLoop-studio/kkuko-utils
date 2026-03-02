import { WordServiceContainer } from '@/src/lib/services/WordServiceContainer';
import type { IDocsLogWriter, IWordLogWriter, IUserContributionUpdater } from '@/src/lib/services/application/word/WordCommandService';
import { WordQueryService } from '@/src/lib/services/application/word/WordQueryService';
import { WordCommandService } from '@/src/lib/services/application/word/WordCommandService';

/** Supabase 클라이언트 mock (최소 구조) */
const mockSupabase = {
    from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('WordServiceContainer', () => {
    it('생성 시 queryService가 초기화된다', () => {
        const container = new WordServiceContainer(mockSupabase);

        expect(container.queryService).toBeInstanceOf(WordQueryService);
        expect(container.wordRepo).toBeDefined();
        expect(container.waitWordRepo).toBeDefined();
        expect(container.themeRepo).toBeDefined();
    });

    it('initCommandService 호출 전 commandService 접근 시 에러를 던진다', () => {
        const container = new WordServiceContainer(mockSupabase);

        expect(() => container.commandService).toThrow(
            'WordCommandService가 초기화되지 않았습니다. initCommandService()를 먼저 호출하세요.'
        );
    });

    it('initCommandService 호출 후 commandService를 사용할 수 있다', () => {
        const container = new WordServiceContainer(mockSupabase);

        const mockDocsLogWriter: IDocsLogWriter = {
            writeDocsLog: jest.fn(),
            getAllDocs: jest.fn(),
            updateDocsLastUpdate: jest.fn(),
        };
        const mockWordLogWriter: IWordLogWriter = {
            writeWordLog: jest.fn(),
        };
        const mockUserContributionUpdater: IUserContributionUpdater = {
            incrementContribution: jest.fn(),
        };

        const commandService = container.initCommandService(
            mockDocsLogWriter,
            mockWordLogWriter,
            mockUserContributionUpdater,
        );

        expect(commandService).toBeInstanceOf(WordCommandService);
        expect(container.commandService).toBe(commandService);
    });

    it('initCommandService를 여러 번 호출하면 마지막 인스턴스를 사용한다', () => {
        const container = new WordServiceContainer(mockSupabase);

        const firstWriter: IDocsLogWriter = {
            writeDocsLog: jest.fn(),
            getAllDocs: jest.fn(),
            updateDocsLastUpdate: jest.fn(),
        };
        const secondWriter: IDocsLogWriter = {
            writeDocsLog: jest.fn(),
            getAllDocs: jest.fn(),
            updateDocsLastUpdate: jest.fn(),
        };
        const mockWordLogWriter: IWordLogWriter = { writeWordLog: jest.fn() };
        const mockUpdater: IUserContributionUpdater = { incrementContribution: jest.fn() };

        container.initCommandService(firstWriter, mockWordLogWriter, mockUpdater);
        const second = container.initCommandService(secondWriter, mockWordLogWriter, mockUpdater);

        expect(container.commandService).toBe(second);
    });
});
