export type DocsContentType = 'letter' | 'theme' | 'ect';

export interface DocsContentWord {
    word: string;
    status: 'ok' | 'add' | 'delete';
    requesterNickname?: string;
}

export interface DocsContentProjection {
    metadata: {
        id: number;
        title: string;
        lastUpdatedAt: string;
        type: DocsContentType;
    };
    starredUserIds: string[];
    words: DocsContentWord[];
    isSpecial: boolean;
    isMissionParent: boolean;
}
