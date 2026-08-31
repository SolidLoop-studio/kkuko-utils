declare global{
    type ErrorMessage = {
        component: string;
        ErrName:string | null;
        ErrMessage: string | null;
        ErrStackRace:string | undefined | null;
        HTTPStatus? : string | number | null;
        HTTPData?: string | null;
        inputValue: string | null;
        location?: string | null;
    }
    type FetchError = {
        name: string;
        httpCode: number | null;
        message: string | null;
        data?: string;
        stackTrace?: string;
    }
}

export {};
