export type UserWordThemeChangeType = 'add' | 'delete';

export type UserWordThemeChange = {
    themeCode: string;
    type: UserWordThemeChangeType;
};

export type RequestWordThemeChangesCommand = {
    word: string;
    changes: UserWordThemeChange[];
};

export type RequestedWordThemeChange = UserWordThemeChange & {
    themeName: string;
};

export type RequestWordThemeChangesResult = {
    word: string;
    changes: RequestedWordThemeChange[];
};
