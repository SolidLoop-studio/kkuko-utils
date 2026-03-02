export type CustomError = {
    /** 오류의 이름 */
    name: string;
    /** 오류 메시지 */
    message: string;
    /** 오류 스택 추적 정보 */
    stack?: string;
    /** 오류의 상세 정보 */
    details?: string;
    /** 오류에 대한 힌트 */
    hint?: string;
    /** 오류 코드 */
    code?: string | number;
    /** HTTP 상태 코드 */
    httpStatus?: number;
}

export type Result<T, E extends CustomError> = 
    | { success: true; data: T; error: null } 
    | { success: false; data: null; error: E };

/**
 * 성공인 결과를 생성하는 데 도움이 되는 함수입니다.
 * @param data 성공 결과에 포함될 데이터입니다.
 * @returns 성공 결과 객체입니다.
 */
export const success = <T>(data: T): Result<T, never> => ({
    success: true,
    data,
    error: null,
});

/**
 * 실패인 결과를 생성하는 데 도움이 되는 함수입니다.
 * @param error 실패 결과에 포함될 오류 객체입니다. 이 객체는 CustomError 타입을 확장해야 합니다.
 * @returns 실패 결과 객체입니다.
 */
export const failure = <E extends CustomError>(error: E): Result<never, E> => ({
    success: false,
    data: null,
    error,
});