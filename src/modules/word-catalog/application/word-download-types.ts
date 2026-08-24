export type WordDownloadFilter = {
    includeAdded: boolean;
    includeDeleted: boolean;
    includeAcknowledged: boolean;
    includeNotAcknowledged: boolean;
    onlyWordChain: boolean;
};

export type WordDownloadRegisteredWord = {
    word: string;
    isNoInjung: boolean;
    canUseInWordChain: boolean;
};

export type WordDownloadPendingRequest = {
    word: string;
    type: 'add' | 'delete';
};

export type WordDownloadSource = {
    registeredWords: WordDownloadRegisteredWord[];
    pendingRequests: WordDownloadPendingRequest[];
};

export type WordDownloadStats = {
    totalCount: number;
    acknowledgedCount: number;
    notAcknowledgedCount: number;
    addedCount: number;
    deletedCount: number;
    wordChainCount: number;
    wordNotChainCount: number;
};

export type WordDownloadData = {
    words: string[];
    stats: WordDownloadStats;
};
