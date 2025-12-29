/**
 * Map객체 정렬하는 함수 
 * 
 * 우선순위 : 
 * 
 * 1.value의 값(오름차순)
 * 
 * 2.key의 유니코드 값 (우름차순)
 * @param {Map<string, number>} map 정렬할 map 객체
 * @returns {Map<string, number>} 정렬된 map 객체
 */
function sortMap(map: Map<string, number>): Map<string, number> {
    // Map을 배열로 변환하여 정렬한 후, 다시 Map 객체로 변환
    const sortedEntries = [...map.entries()]
        .sort(([keyA, valueA], [keyB, valueB]) => {
            // 값이 작을 순으로 정렬
            if (valueA !== valueB) {
                return valueA - valueB;
            }
            // 값이 같으면 키를 알파벳 순으로 정렬
            return keyA.localeCompare(keyB);
        });

    // 정렬된 배열을 Map으로 변환하여 반환
    return new Map(sortedEntries);
}

/**
 *  단어 조합 매니저 클래스
 */
class CombinationManager {

    syllable: string;
    words: string[];
    possibleWords: string[];
    letterCount: { [key: string]: number };
    wordCount: Map<string, number>;
    syllableCount: { [key: string]: number };

    /**
     * 
     * @param {string} syllable 조합에 사용될수 있는 글자들(중복도 같이 적어야함 ex<가가가나>)
     * @param {string[]} words 조합에 사용할수 있는 단어 목록(중복 포함x) 
     */
    constructor(syllable: string, words: string[]) {
        // 초기화
        this.syllable = syllable;           // 음절(문자열)을 저장
        this.words = words;                 // 전체 단어 리스트를 저장
        this.possibleWords = [];            // 가능한 단어 목록을 저장
        this.letterCount = {};              // 각 글자의 빈도수를 저장
        this.wordCount = new Map();         // 각 단어의 점수를 저장
        this.syllableCount = {};            // 음절(문자열) 빈도수를 저장
        this.__init__();
    }

    /**
     * 기본 setting 함수 (단어 배열 처리 / 음절 처리 / 만들수 있는 단어 선별)
     */
    private __init__() {
        this.countLetter();
        this.countSyllable();
        this.findPossibleWords();
        this.countWord();
        this.wordCount = sortMap(this.wordCount);
    }

    /**
     * 주어진 음절,주어진 단어목록으로 만들수 있는 단어들을 그리디 접근적으로 하여 단어를 만드는 함수
     * @returns {string[]} 만들수 있는단어 목록
     */
    public getBests(): string[] {
        const temp: string[] = [];
        while (this.wordCount.size > 0) {
            for (const [word] of this.wordCount) {
                if (this.exist(word)) {
                    temp.push(word); //만들수 있으면 반환배열 추가 (그리디로 얻은것들을 정렬하여 앞에 두었으므로 첫키가 탐욕적으로 최상의 결과임.)
                    this.deleteWord(word);
                    break
                }
                else {
                    this.wordCount.delete(word); //없으면 제거(다음에 탐색에서 제거)
                }
            }
        }
        return temp.length > 0 ? temp : ['No possible words found.'];


    }

    /**
     * 음절 카운트에서 감소하는 것을 처리하는 함수
     * @param {string} word 사용가능한 음절 목록에서 삭제할 음절들 
     */
    private deleteWord(word: string) {
        for (const s of word) {
            this.syllableCount[s]--;
        }
    }

    /**
     * 가능한 단어 찾는 함수
     */
    private findPossibleWords() {
        if (this.possibleWords.length === 0) {
            for (const word of this.words) {
                if (this.exist(word)) {
                    this.possibleWords.push(word);
                }
            }
        } else {
            this.fastFindPossibleWords();
        }

    }

    /**
     * 가능한 단어 찾는 함수(이미 가능한 단어 배열이 있을때만 호출. -> 가능한 단어 배열중 만들수 없는 단어들 cutting.)
     */
    private fastFindPossibleWords() {
        const temp: string[] = [];
        for (const word of this.possibleWords) {
            if (this.exist(word)) {
                temp.push(word);
            }
        }
        this.possibleWords = temp;
    }

    /**
     * 가능한 단어들을 그리디 접근적으로 처리하는 함수 
     * 
     * 단어 사전에 있는 글자들의 출현 횟수를 점수로 취급
     * 
     * 점수가 작을수록 최상이라는 탐욕접근
     */
    private countWord() {
        this.wordCount = new Map();                // wordCount 초기화
        for (const word of this.possibleWords) {
            let count = 0;
            for (const letter of word) {
                count += this.letterCount[letter] || 0;  // 각 글자의 빈도 합산
            }
            this.wordCount.set(word, count);    // 단어별 점수 저장
        }
    }

    /**
     * 단어 사전의 단어들의 글자 출현 횟수 counting 함수 (나중에 단어들의 점수로 활용됨)
     */
    private countLetter() {
        this.letterCount = {};              // letterCount 초기화
        for (const word of this.words) {
            for (const letter of word) {
                // 각 글자의 빈도수 증가
                this.letterCount[letter] = (this.letterCount[letter] || 0) + 1;
            }
        }
    }

    /**
     * 사용가능한 음절들을 counting하는 함수(음절 문자열에서 replace하는것 보다 효율적일듯)
     */
    private countSyllable() {
        this.syllableCount = {};
        for (const s of this.syllable) {
            this.syllableCount[s] = (this.syllableCount[s] || 0) + 1;
        }
    }

    /**
     * 만들수 있는지 확인하는 함수
     * @param {string} word 만들수 있는 단어인지 확인할 대상
     * @returns {boolean} 만들수 있으면 true / 만들수 없으면 false
     */
    private exist(word: string): boolean {
        const temp: { [key: string]: number } = {};
        for (const s of word) {
            temp[s] = (temp[s] || 0) + 1;
        }

        for (const s of word) {
            if (!this.syllableCount[s] || (this.syllableCount[s] < temp[s])) {
                return false;
            }
        }
        return true;
    }

    /**
     * 남아 있는 음절들을 정렬하여 반환하는 함수
     * @returns {string} 정렬된 음절 문자열
     */
    public remainStr(): string {
        const result = [];
        for (const [syllable, count] of Object.entries(this.syllableCount)) {
            if (count > 0) {
                result.push(syllable.repeat(count));
            }
        }
        return result.sort().join('');
    }

}


export default CombinationManager;