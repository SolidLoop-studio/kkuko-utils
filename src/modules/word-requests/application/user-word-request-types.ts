export type UserWordRequestCommand = { word: string };

export type RequestWordAdditionCommand = {
    word: string;
    themeCodes: string[];
};

export type RequestedWordAdditionTheme = {
    themeCode: string;
    themeName: string;
};

export type RequestWordAdditionResult = {
    requestId: number;
    word: string;
    requestType: 'add';
    themes: RequestedWordAdditionTheme[];
};

export type RequestWordAdditionsCommand = {
    entries: RequestWordAdditionCommand[];
};

export type RequestWordAdditionsResult = {
    requestedWordCount: number;
    createdWordRequestCount: number;
    updatedWordRequestCount: number;
    changedRegisteredWordCount: number;
    createdThemeChangeRequestCount: number;
    unchangedWordCount: number;
};

export type RequestWordAdditionsProgress = {
    completedWordCount: number;
    totalWordCount: number;
};

export type RequestWordAdditionsProgressListener = (
    progress: RequestWordAdditionsProgress,
) => void;

export type UserWordRequestResult = {
    requestId: number;
    word: string;
    requestType: 'add' | 'delete';
};
