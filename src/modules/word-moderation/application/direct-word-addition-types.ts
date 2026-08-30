export interface DirectWordAdditionCommand {
    word: string;
    themeCodes: string[];
}

export interface DirectWordAdditionGatewayCommand {
    word: string;
    themeCodes: string[];
}

export interface DirectWordAdditionResult {
    wordId: number;
    word: string;
    noinCanUse: boolean;
    themeIds: number[];
    affectedDocsIds: number[];
}
