export type DocsType = 'letter' | 'theme' | 'ect';

export interface DocsSummary {
    id: number;
    name: string;
    makerNickname: string | null;
    lastUpdatedAt: string;
    createdAt: string;
    type: DocsType;
}
