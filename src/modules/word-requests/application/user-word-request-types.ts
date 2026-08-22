export type UserWordRequestCommand = { word: string };

export type UserWordRequestResult = {
    requestId: number;
    word: string;
    requestType: 'add' | 'delete';
};
