import { WordDomainService } from '@/src/lib/services/domain/word/WordDomainService';

/** hangulUtils, lib 함수의 실제 구현에 의존 (통합 테스트 성격) */
describe('WordDomainService', () => {
    let service: WordDomainService;

    beforeEach(() => {
        service = new WordDomainService();
    });

    describe('applyDuemLaw', () => {
        it('ㄹ → ㄴ 두음법칙을 적용한다 (모음: ㅏ,ㅐ,ㅗ,ㅚ,ㅜ,ㅡ)', () => {
            expect(service.applyDuemLaw('락')).toBe('낙');
            expect(service.applyDuemLaw('로')).toBe('노');
            expect(service.applyDuemLaw('루')).toBe('누');
        });

        it('ㄹ → ㅇ 두음법칙을 적용한다 (모음: ㅑ,ㅕ,ㅖ,ㅛ,ㅠ,ㅣ)', () => {
            expect(service.applyDuemLaw('량')).toBe('양');
            expect(service.applyDuemLaw('려')).toBe('여');
            expect(service.applyDuemLaw('리')).toBe('이');
        });

        it('ㄴ → ㅇ 두음법칙을 적용한다 (모음: ㅕ,ㅛ,ㅠ,ㅣ)', () => {
            expect(service.applyDuemLaw('녀')).toBe('여');
            expect(service.applyDuemLaw('뇨')).toBe('요');
            expect(service.applyDuemLaw('니')).toBe('이');
        });

        it('두음법칙 대상이 아니면 원래 글자를 반환한다', () => {
            expect(service.applyDuemLaw('가')).toBe('가');
            expect(service.applyDuemLaw('바')).toBe('바');
        });
    });

    describe('reverseDuemLaw', () => {
        it('두음법칙 역변환으로 가능한 글자 배열을 반환한다', () => {
            const result = service.reverseDuemLaw('여');
            expect(result).toContain('려');
            expect(result).toContain('녀');
        });

        it('역변환 대상이 아니면 빈 배열이나 원본만 포함한다', () => {
            const result = service.reverseDuemLaw('가');
            // 두음법칙 역대상이 아닌 경우
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('computeMissionMask', () => {
        it('빈 배열이면 0을 반환한다', () => {
            expect(service.computeMissionMask([])).toBe(0);
        });

        it('문자 배열로 비트마스크를 계산한다', () => {
            const mask = service.computeMissionMask(['가']);
            expect(typeof mask).toBe('number');
            expect(mask).toEqual(1);
        });
    });

    describe('isNoinWord', () => {
        it('노인정 테마 코드(0~530, 10 단위)가 있으면 true를 반환한다', () => {
            expect(service.isNoinWord(['0'])).toBe(true);
            expect(service.isNoinWord(['10'])).toBe(true);
            expect(service.isNoinWord(['530'])).toBe(true);
        });

        it('노인정 테마 코드가 아닌 값이면 false를 반환한다', () => {
            expect(service.isNoinWord(['5'])).toBe(false);
            expect(service.isNoinWord(['ABC'])).toBe(false);
        });

        it('빈 배열이면 false를 반환한다', () => {
            expect(service.isNoinWord([])).toBe(false);
        });
    });

    describe('calculateInitials', () => {
        it('한글 단어의 초성을 추출한다', () => {
            expect(service.calculateInitials('사과')).toBe('ㅅㄱ');
            expect(service.calculateInitials('바나나')).toBe('ㅂㄴㄴ');
            expect(service.calculateInitials('한글')).toBe('ㅎㄱ');
        });
    });

    describe('matchDocsForWord', () => {
        const allDocs = [
            { id: 1, name: '가', typez: 'letter' },
            { id: 2, name: '나', typez: 'letter' },
            { id: 3, name: '다', typez: 'letter' },
            { id: 10, name: '동물', typez: 'theme' },
            { id: 11, name: '식물', typez: 'theme' },
            { id: 12, name: '과학', typez: 'theme' },
        ];

        it('단어의 마지막 글자에 매칭되는 글자 문서를 반환한다', () => {
            const result = service.matchDocsForWord('바나나', [], allDocs);

            expect(result.letterDocs).toEqual([{ id: 2, name: '나' }]);
            expect(result.themeDocs).toEqual([]);
        });

        it('테마 이름에 매칭되는 테마 문서를 반환한다', () => {
            const result = service.matchDocsForWord('강아지', ['동물'], allDocs);

            expect(result.themeDocs).toEqual([{ id: 10, name: '동물' }]);
        });

        it('글자 문서와 테마 문서를 동시에 반환한다', () => {
            const result = service.matchDocsForWord('사과', ['식물', '과학'], allDocs);

            // '사과'의 마지막 글자 '과'는 글자문서에 없음
            expect(result.letterDocs).toEqual([]);
            expect(result.themeDocs).toHaveLength(2);
            expect(result.themeDocs).toContainEqual({ id: 11, name: '식물' });
            expect(result.themeDocs).toContainEqual({ id: 12, name: '과학' });
        });

        it('매칭되는 문서가 없으면 빈 배열을 반환한다', () => {
            const result = service.matchDocsForWord('흙', [], allDocs);

            expect(result.letterDocs).toEqual([]);
            expect(result.themeDocs).toEqual([]);
        });

        it('여러 글자 문서에 매칭될 수 있다 (마지막 글자 기준)', () => {
            const docsWithDups = [
                { id: 1, name: '가', typez: 'letter' },
                { id: 2, name: '가', typez: 'letter' },
            ];
            const result = service.matchDocsForWord('호가', [], docsWithDups);

            expect(result.letterDocs).toHaveLength(2);
        });
    });
});
