export type PendingWordModerationRequestType = 'add' | 'delete' | 'theme_change';
export type PendingWordModerationThemeType = 'add' | 'delete';

export type PendingWordModerationTheme = {
    id: number;
    name: string;
    code: string;
    type?: PendingWordModerationThemeType;
};

/** 관리자 단어 요청 목록에 필요한 안정적인 조회 프로젝션입니다. */
export type PendingWordModerationRequest = {
    id: number;
    word: string;
    requestType: PendingWordModerationRequestType;
    requestedAt: string;
    requesterId?: string;
    requesterNickname: string;
    themes?: PendingWordModerationTheme[];
    wordId?: number;
};
