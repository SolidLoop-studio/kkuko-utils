export type DocsInfoType = 'letter' | 'theme' | 'ect';

export interface DocsInfoProjection {
    metadata: {
        id: number;
        createdAt: string;
        name: string;
        makerNickname: string | null;
        type: DocsInfoType;
        lastUpdatedAt: string;
        views: number;
    };
    wordCount: number;
    starCount: number;
    viewRank: number;
}
