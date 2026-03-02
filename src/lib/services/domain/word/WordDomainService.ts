import { duemLaw, reverDuemLaw } from '@/src/lib/hangulUtils';
import { isNoin, calculateKoreanInitials, misssionCharMask } from '@/src/app/lib/lib';

/**
 * Word 도메인 서비스
 *
 * 한글 두음법칙, 미션문자 마스크, 노인정 판별, 초성 계산 등
 * 순수 도메인 로직을 집중적으로 관리합니다.
 * 기존 hangulUtils.ts, lib.ts에 분산된 함수들을 조합하여 도메인 의미를 부여합니다.
 */
export class WordDomainService {
    /**
     * 두음법칙을 적용합니다.
     *
     * @param char - 한 글자 (한글)
     * @returns 두음법칙이 적용된 글자
     */
    applyDuemLaw(char: string): string {
        return duemLaw(char, true);
    }

    /**
     * 두음법칙 역함수를 적용합니다.
     * 주어진 글자에서 두음법칙으로 변환될 수 있는 모든 글자를 반환합니다.
     *
     * @param char - 한 글자 (한글)
     * @returns 두음법칙이 적용될 수 있는 글자 배열
     */
    reverseDuemLaw(char: string): string[] {
        return reverDuemLaw(char, true);
    }

    /**
     * 미션 문자 비트마스크를 계산합니다.
     *
     * @param chars - 문자 배열
     * @returns 미션 문자 비트마스크 (number)
     */
    computeMissionMask(chars: string[]): number {
        return misssionCharMask(chars);
    }

    /**
     * 테마 코드 목록으로 노인정 단어 여부를 판별합니다.
     *
     * @param themeCodes - 테마 코드 배열
     * @returns 노인정 단어 여부
     */
    isNoinWord(themeCodes: string[]): boolean {
        return isNoin(themeCodes);
    }

    /**
     * 단어의 초성을 계산합니다.
     *
     * @param word - 한글 단어
     * @returns 초성 문자열
     */
    calculateInitials(word: string): string {
        return calculateKoreanInitials(word);
    }

    /**
     * 단어에 매칭되는 문서(글자 문서 + 테마 문서)를 찾습니다.
     *
     * 현재 TableWorkFunc.tsx 등 7곳에 중복되어 있던 docs-matching 로직을 한 곳에 집중합니다.
     *
     * @param word - 대상 단어 문자열
     * @param themeNames - 단어에 연결된 테마 이름 배열
     * @param allDocs - 전체 문서 목록
     * @returns 매칭된 글자 문서와 테마 문서
     */
    matchDocsForWord(
        word: string,
        themeNames: string[],
        allDocs: { id: number; name: string; typez: string }[]
    ): {
        letterDocs: { id: number; name: string }[];
        themeDocs: { id: number; name: string }[];
    } {
        const lastChar = word[word.length - 1];

        const letterDocs = allDocs
            .filter(({ typez }) => typez === 'letter')
            .filter(({ name }) => name === lastChar)
            .map(({ id, name }) => ({ id, name }));

        const themeDocs = allDocs
            .filter(({ typez }) => typez === 'theme')
            .filter(({ name }) => themeNames.includes(name))
            .map(({ id, name }) => ({ id, name }));

        return { letterDocs, themeDocs };
    }
}
