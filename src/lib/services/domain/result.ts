/**
 * 커스텀 오류 타입을 정의합니다. 이 타입은 오류의 이름, 메시지, 스택 추적 정보, 상세 정보, 힌트, 코드, HTTP 상태 코드 등을 포함할 수 있습니다.
 */
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

/**
 * 성공과 실패를 명확하게 구분하는 Result 타입입니다.
 * 성공인 경우 data 필드에 결과 데이터가 포함되고, error 필드는 null입니다.
 * 실패인 경우 error 필드에 CustomError 객체가 포함되고, data 필드는 null입니다.
 */
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