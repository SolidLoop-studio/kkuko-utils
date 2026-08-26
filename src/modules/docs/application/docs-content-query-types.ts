import type { MissionChildReference } from './docs-reference-types';

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
    missionCharacter: MissionChildReference['character'] | null;
    isSpecial: boolean;
    isMissionParent: boolean;
}
