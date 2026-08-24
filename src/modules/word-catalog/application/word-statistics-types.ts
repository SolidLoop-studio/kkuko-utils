export type WordStatisticEntry = {
    letter: string;
    acknowledgedCount: number;
    notAcknowledgedCount: number;
    acknowledgedUpdatedAt: string | null;
    notAcknowledgedUpdatedAt: string | null;
};

export type WordStatistics = {
    firstLetter: WordStatisticEntry[];
    lastLetter: WordStatisticEntry[];
    threeLetter: WordStatisticEntry[];
};
