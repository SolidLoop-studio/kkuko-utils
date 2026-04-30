import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/app/types/database.types';
import { SupabaseWordRepository } from './infrastructure/supabase/SupabaseWordRepository';
import { SupabaseWaitWordRepository } from './infrastructure/supabase/SupabaseWaitWordRepository';
import { SupabaseThemeRepository } from './infrastructure/supabase/SupabaseThemeRepository';
import { WordQueryService } from './application/word/WordQueryService';
import { WordCommandService } from './application/word/WordCommandService';
import type { IDocsLogWriter, IWordLogWriter, IUserContributionUpdater } from './application/word/WordCommandService';
import type { IWordRepository } from './domain/word/WordRepository';
import type { IWaitWordRepository } from './domain/word/WaitWordRepository';
import type { IThemeRepository } from './domain/word/ThemeRepository';
import { createDocsServiceContainer } from './DocsServiceContainer';
import { createUserServiceContainer } from './UserServiceContainer';
import { createLogServiceContainer } from './LogServiceContainer';

/**
 * Word 도메인 서비스 컨테이너
 *
 * Supabase 클라이언트를 받아 Word 도메인의 모든 서비스 인스턴스를 생성합니다.
 * Strangler Fig 패턴에 따라 기존 SCM과 공존하며 점진적으로 이관합니다.
 */
export class WordServiceContainer {
    public readonly wordRepo: IWordRepository;
    public readonly waitWordRepo: IWaitWordRepository;
    public readonly themeRepo: IThemeRepository;
    public readonly queryService: WordQueryService;
    private _commandService: WordCommandService | null = null;

    constructor(private readonly supabase: SupabaseClient<Database>) {
        this.wordRepo = new SupabaseWordRepository(supabase);
        this.waitWordRepo = new SupabaseWaitWordRepository(supabase);
        this.themeRepo = new SupabaseThemeRepository(supabase);
        this.queryService = new WordQueryService(
            this.wordRepo,
            this.waitWordRepo,
            this.themeRepo,
        );
    }

    /**
     * WordCommandService를 초기화합니다.
     *
     * WordCommandService는 Docs, Log, User 도메인에 의존하므로
     * 해당 의존성이 준비된 후 호출해야 합니다.
     *
     * @param docsLogWriter - 문서 로그 기록기
     * @param wordLogWriter - 단어 로그 기록기
     * @param userContributionUpdater - 유저 기여도 업데이터
     * @returns WordCommandService 인스턴스
     */
    initCommandService(
        docsLogWriter: IDocsLogWriter,
        wordLogWriter: IWordLogWriter,
        userContributionUpdater: IUserContributionUpdater,
    ): WordCommandService {
        this._commandService = new WordCommandService(
            this.wordRepo,
            this.waitWordRepo,
            this.themeRepo,
            docsLogWriter,
            wordLogWriter,
            userContributionUpdater,
        );
        return this._commandService;
    }

    /**
     * WordCommandService 인스턴스를 반환합니다.
     *
     * @throws initCommandService가 호출되지 않은 경우 에러
     */
    get commandService(): WordCommandService {
        if (!this._commandService) {
            throw new Error(
                'WordCommandService가 초기화되지 않았습니다. initCommandService()를 먼저 호출하세요.'
            );
        }
        return this._commandService;
    }
}

/**
 * Supabase 클라이언트로 Word 서비스 컨테이너를 생성하고 CommandService까지 초기화합니다.
 *
 * @param supabase - Supabase 클라이언트
 * @returns 초기화된 WordServiceContainer
 */
export function createWordServiceContainer(supabase: SupabaseClient<Database>): WordServiceContainer {
    const container = new WordServiceContainer(supabase);

    const docsContainer = createDocsServiceContainer(supabase);
    const userContainer = createUserServiceContainer(supabase);
    const logContainer = createLogServiceContainer(supabase);

    container.initCommandService(
        docsContainer.commandService,
        logContainer.service,
        userContainer.userService,
    );

    return container;
}
