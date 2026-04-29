import {
    wordNotFoundError,
    wordAlreadyExistsError,
    themeNotFoundError,
    unauthorizedError,
    validationError,
    waitWordNotFoundError,
    infrastructureError,
    docsNotFoundError,
    waitDocsNotFoundError,
} from '@/src/lib/services/domain/errors';

describe('Domain Errors', () => {
    describe('wordNotFoundError', () => {
        it('올바른 에러 속성을 반환한다', () => {
            const error = wordNotFoundError('사과');

            expect(error.name).toBe('WordNotFoundError');
            expect(error.message).toBe("단어 '사과'를 찾을 수 없습니다.");
            expect(error.httpStatus).toBe(404);
            expect(error.code).toBe('WORD_NOT_FOUND');
        });
    });

    describe('wordAlreadyExistsError', () => {
        it('올바른 에러 속성을 반환한다', () => {
            const error = wordAlreadyExistsError('바나나');

            expect(error.name).toBe('WordAlreadyExistsError');
            expect(error.message).toBe("단어 '바나나'가 이미 존재합니다.");
            expect(error.httpStatus).toBe(409);
            expect(error.code).toBe('WORD_ALREADY_EXISTS');
        });
    });

    describe('themeNotFoundError', () => {
        it('올바른 에러 속성을 반환한다', () => {
            const error = themeNotFoundError('동물');

            expect(error.name).toBe('ThemeNotFoundError');
            expect(error.message).toBe("테마 '동물'를 찾을 수 없습니다.");
            expect(error.httpStatus).toBe(404);
            expect(error.code).toBe('THEME_NOT_FOUND');
        });
    });

    describe('unauthorizedError', () => {
        it('기본 메시지로 에러를 반환한다', () => {
            const error = unauthorizedError();

            expect(error.name).toBe('UnauthorizedError');
            expect(error.message).toBe('인증이 필요합니다.');
            expect(error.httpStatus).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
        });

        it('커스텀 메시지를 사용할 수 있다', () => {
            const error = unauthorizedError('관리자 권한이 필요합니다.');

            expect(error.message).toBe('관리자 권한이 필요합니다.');
        });
    });

    describe('validationError', () => {
        it('메시지와 details를 포함한다', () => {
            const error = validationError('입력값이 올바르지 않습니다.', '빈 문자열 불가');

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('입력값이 올바르지 않습니다.');
            expect(error.httpStatus).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.details).toBe('빈 문자열 불가');
        });

        it('details 없이 생성할 수 있다', () => {
            const error = validationError('오류');

            expect(error.details).toBeUndefined();
        });
    });

    describe('waitWordNotFoundError', () => {
        it('문자열 식별자로 에러를 생성한다', () => {
            const error = waitWordNotFoundError('포도');

            expect(error.name).toBe('WaitWordNotFoundError');
            expect(error.message).toBe("대기 단어 '포도'를 찾을 수 없습니다.");
            expect(error.httpStatus).toBe(404);
            expect(error.code).toBe('WAIT_WORD_NOT_FOUND');
        });

        it('숫자 식별자로 에러를 생성한다', () => {
            const error = waitWordNotFoundError(42);

            expect(error.message).toBe("대기 단어 '42'를 찾을 수 없습니다.");
        });
    });

    describe('infrastructureError', () => {
        it('원본 에러 정보를 래핑한다', () => {
            const error = infrastructureError({
                message: 'connection failed',
                details: 'timeout',
                hint: 'check network',
                code: '08001',
            });

            expect(error.name).toBe('InfrastructureError');
            expect(error.message).toBe('connection failed');
            expect(error.httpStatus).toBe(500);
            expect(error.details).toBe('timeout');
            expect(error.hint).toBe('check network');
            expect(error.code).toBe('08001');
        });

        it('code가 없으면 기본 코드를 사용한다', () => {
            const error = infrastructureError({ message: 'unknown' });

            expect(error.code).toBe('INFRASTRUCTURE_ERROR');
        });
    });

    describe('docsNotFoundError', () => {
        it('문자열 식별자로 에러를 생성한다', () => {
            const error = docsNotFoundError('테스트단어장');
            expect(error.name).toBe('DocsNotFoundError');
            expect(error.message).toBe("단어장 '테스트단어장'를 찾을 수 없습니다.");
            expect(error.httpStatus).toBe(404);
            expect(error.code).toBe('DOCS_NOT_FOUND');
        });
        it('숫자 식별자로 에러를 생성한다', () => {
            const error = docsNotFoundError(1);
            expect(error.message).toBe("단어장 '1'를 찾을 수 없습니다.");
        });
    });

    describe('waitDocsNotFoundError', () => {
        it('문자열 식별자로 에러를 생성한다', () => {
            const error = waitDocsNotFoundError('대기단어장');
            expect(error.name).toBe('WaitDocsNotFoundError');
            expect(error.message).toBe("대기 단어장 '대기단어장'를 찾을 수 없습니다.");
            expect(error.httpStatus).toBe(404);
            expect(error.code).toBe('WAIT_DOCS_NOT_FOUND');
        });
        it('숫자 식별자로 에러를 생성한다', () => {
            const error = waitDocsNotFoundError(99);
            expect(error.message).toBe("대기 단어장 '99'를 찾을 수 없습니다.");
        });
    });
});
