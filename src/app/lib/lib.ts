import { disassemble } from "es-hangul";

/**
 * 노인정 단어인지 주제보고 추론하는 함수
 * 
 * @param themes 주제목록 (코드)
 * @returns 노인정 여부
 */
export function isNoin(themes: string[]): boolean{
    const ttt = Array.from({ length: 54 }, (_, i) => (i * 10).toString());
    return ttt.some(v => themes.includes(v));
}

/**
 * 단어 초성 반환 함수
 * 
 * @param word 단어
 * @returns 단어의 초성
 */
export function calculateKoreanInitials(word: string): string{
    return word.split("").map((c) => disassemble(c)[0]).join("");
} 

/**
 * 문자열에 해당 문자가 몇개 들어있는지 반환하는 함수
 * 
 * @param a 검사당할 피 문자열
 * @param target 찾을 문자열
 * @returns target의 포함 개수
 */
export function count(a: string, target: string): number{
    return (a.match(new RegExp(target, "gi")) || []).length
}

/**
 * 미션 문자 마스크 생성 함수
 * 
 * @param chars 문자 배열
 * @returns 미션 문자 마스크
 */
export function misssionCharMask(chars: string[]): number {
    let base = 0;
    const missionChars = ['가','나','다','라','마','바','사','아','자','차','카','타','파','하'];
    for (const c of chars) {
        if (missionChars.includes(c)) {
            base = base | (1 << missionChars.indexOf(c));
        }
    }
    return base;
}


/**
 * 한글 텍스트 필터링 함수
 * 
 * @param text 필터링할 텍스트
 * @param search 검색할 텍스트
 * @returns text가 search를 포함하는지 여부
 */
export function filterKoreanText(text: string, search: string): boolean {
    if (search === "") return true;
    let indexText = 0;
    let indexSearch = 0;

    while (indexText < text.length && indexSearch < search.length) {
        if (
            text[indexText] === search[indexSearch] ||
            (("ㄱ" <= search[indexSearch] && search[indexSearch] <= "ㅎ") &&
                calculateKoreanInitials(text[indexText]) === calculateKoreanInitials(search[indexSearch]))
        ) {
            indexSearch++;
        }
        indexText++;
    }

    return indexSearch === search.length;
};