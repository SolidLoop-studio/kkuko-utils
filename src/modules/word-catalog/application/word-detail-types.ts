export type WordDetailStatus = 'registered' | 'pending-addition' | 'pending-deletion';

export interface WordDetailDocument {
    id: number;
    name: string;
}

export interface WordDetail {
    id: number;
    word: string;
    status: WordDetailStatus;
    canUseInChain: boolean;
    canUseWithoutInjeong: boolean;
    requesterId?: string;
    requesterNickname?: string;
    requestedAt?: string;
    themes: {
        approved: string[];
        pendingAddition: string[];
        pendingDeletion: string[];
    };
    documents: WordDetailDocument[];
    previousWordCount: number;
    nextWordCount: number;
}

export type WordConnectionDirection = 'previous' | 'next';

export interface FindRandomConnectedWordInput {
    direction: WordConnectionDirection;
    letters: string[];
}
