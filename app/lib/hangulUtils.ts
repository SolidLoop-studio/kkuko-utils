import { disassemble, assemble } from 'es-hangul';

const DUEM_LIST_1 = ['ㅏ','ㅐ','ㅗ','ㅚ','ㅜ','ㅡ'] //두음 1
const DUEM_LIST_2 = ['ㅑ','ㅕ','ㅖ','ㅛ','ㅠ','ㅣ'] //두음 2
const DUEM_LIST_3 = ['ㅕ','ㅛ','ㅠ','ㅣ'] //두음 3

/**
 * 두음법칙 함수
 * 
 * @param c - 한글자 단어
 * @param ignoreError - 에러 무시 여부
 * @returns - 두음법칙 적용된 글자
 * @throws - 한글자가 아닌 경우 에러 발생
 */
export function duemLaw(c:string, ignoreError?: boolean): string {
    if (c.length !== 1) {
        if (ignoreError) {
            return c;
        }
        throw new Error('한글자만 입력해주세요');
    }
    
    const jamos_list = disassemble(c).split('');
    if (jamos_list.length < 2) return c;
    if (DUEM_LIST_1.includes(assemble([jamos_list[1],jamos_list[2]])[0]) && jamos_list[0] == 'ㄹ'){
        jamos_list[0] = 'ㄴ'
    }
    else if ((DUEM_LIST_2.includes(assemble([jamos_list[1],jamos_list[2]])[0]) && jamos_list[0] == 'ㄹ') || (DUEM_LIST_3.includes(assemble([jamos_list[1],jamos_list[2]])[0]) && jamos_list[0] == 'ㄴ')) {
        jamos_list[0] = 'ㅇ'
    } 
    return assemble(jamos_list);
}


/**
 * 두음법칙 역함수
 * 
 * @param c - 한글자 단어
 * @param ignoreError - 에러 무시 여부
 * @returns - 두음법칙이 적용될 수 있는 글자 배열
 * @throws - 한글자가 아닌 경우 에러 발생
 */
export function reverDuemLaw(c: string, ignoreError?: boolean): string[]{
    if (c.length !== 1) {
        if (ignoreError) {
            return [c];
        }
        throw new Error('한글자만 입력해주세요');
    }

    const jamos_list = disassemble(c).split('');
    const reversDuemLetter: string[] = [c];
    if (jamos_list.length < 2) return reversDuemLetter;

    if (jamos_list[0] == 'ㄴ' && DUEM_LIST_1.includes(jamos_list[1])){
        jamos_list[0] = 'ㄹ'
        const i_letter = assemble(jamos_list)
        reversDuemLetter.push(i_letter)
        jamos_list[0] = 'ㄴ'
    }
    if (jamos_list[0] == 'ㅇ' && DUEM_LIST_2.includes(jamos_list[1])){
        jamos_list[0] = 'ㄹ'
        const i_letter = assemble(jamos_list)
        reversDuemLetter.push(i_letter)
        jamos_list[0] = 'ㅇ'
    }
    if (jamos_list[0] == 'ㅇ' && DUEM_LIST_3.includes(jamos_list[1])){
        jamos_list[0] = 'ㄴ'
        const i_letter = assemble(jamos_list)
        reversDuemLetter.push(i_letter)
        jamos_list[0] = 'ㅇ'
    }

    return reversDuemLetter

}

export function isHangul(s: string): boolean {
    const hangulRegex = /^[ㄱ-ㅎ가-힣]+$/;
    return hangulRegex.test(s);
}

/**
 * @deprecated Use deumLaw instead of dl
 */
export default function dl(c: string, ignoreError?: boolean): string {
    return duemLaw(c, ignoreError);
}