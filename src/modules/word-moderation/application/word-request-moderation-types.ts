import type {
    ModerateWordRequestsCommand,
    WordRequestModerationSelection,
} from '@/src/modules/word-moderation/domain/word-request-moderation';

export type {
    ModerateWordRequestsCommand,
    WordRequestModerationSelection,
};

export type WordRequestModerationResult = {
    processedWordRequestCount: number;
    processedThemeChangeCount: number;
    affectedDocsIds: number[];
};
