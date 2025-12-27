import { KOREAN_CHARS, ENGLISH_CHARS, englishRegex, koreanRegex } from '../const';

/**
 * 단어 데이터베이스 및 관련 로직을 관리하는 서비스 클래스
 * Singleton 패턴 적용
 */
export class WordService {
    private static instance: WordService;
    private wordDB: {word: string, theme: string[]}[] = [];
    private wordThemeDB: Map<string, string[]> = new Map();
    private wordSet: Set<string> = new Set();
    
    public NormalStartCharSet: Set<string> = new Set();
    public MissionStartCharSet: Set<[string, string]> = new Set();
    public NormalEngStartCharSet: Set<string> = new Set();
    public MissionEngStartCharSet: Set<[string, string]> = new Set();
    
    public NormalWordMap: Map<string, Set<string>> = new Map();
    public MissionWordMap: Map<string, Set<string>> = new Map();
    public NormalEngWordMap: Map<string, Set<string>> = new Map();
    public MissionEngWordMap: Map<string, Set<string>> = new Map();

    private constructor() {}

    public static getInstance() {
        if (!WordService.instance) {
            WordService.instance = new WordService();
        }
        return WordService.instance;
    }

    public getMissionKey(startChar: string, missionChar: string): string {
        return `${startChar}|${missionChar}`;
    }

    public loadWordDB(data: {word: string, theme: string[]}[]) {
        const pattern = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;
        
        this.wordDB = data.filter(entry => entry.word.replace(pattern, '').length > 1).map(entry => ({word: entry.word.replace(pattern, '').toLowerCase(), theme: entry.theme}));
        this.wordSet = new Set(this.wordDB.map(entry => entry.word));
        this.wordThemeDB = new Map(this.wordDB.map(entry => [entry.word, entry.theme]));
        
        this.NormalStartCharSet = new Set(this.wordDB.filter(entry => koreanRegex.test(entry.word.charAt(0))).map(entry => entry.word.charAt(0)));
        this.NormalEngStartCharSet = new Set(this.wordDB.filter(entry => englishRegex.test(entry.word.charAt(0))).map(entry => entry.word.charAt(0)));
        
        this.NormalWordMap.clear();
        for (const entry of this.wordDB) {
            const startChar = entry.word.charAt(0);
            if (koreanRegex.test(startChar)) {
                if (!this.NormalWordMap.has(startChar)) {
                    this.NormalWordMap.set(startChar, new Set());
                }
                this.NormalWordMap.get(startChar)?.add(entry.word);
            } else if (englishRegex.test(startChar)) {
                if (!this.NormalEngWordMap.has(startChar)) {
                    this.NormalEngWordMap.set(startChar, new Set());
                }
                this.NormalEngWordMap.get(startChar)?.add(entry.word);
            }
        }
        this.MissionStartCharSet.clear();
        this.MissionWordMap.clear();
        this.MissionEngStartCharSet.clear();
        this.MissionEngWordMap.clear();

        for (const entry of this.wordDB) {
            for (const mchar of KOREAN_CHARS) {
                if (entry.word.includes(mchar)) {
                    this.MissionStartCharSet.add([entry.word.charAt(0), mchar]);
                    const key = this.getMissionKey(entry.word.charAt(0), mchar);
                    if (!this.MissionWordMap.has(key)) {
                        this.MissionWordMap.set(key, new Set());
                    }
                    this.MissionWordMap.get(key)?.add(entry.word);
                }
            }
            for (const mchar of ENGLISH_CHARS) {
                if (entry.word.includes(mchar)) {
                    this.MissionEngStartCharSet.add([entry.word.charAt(0), mchar]);
                    const key = this.getMissionKey(entry.word.charAt(0), mchar);
                    if (!this.MissionEngWordMap.has(key)) {
                        this.MissionEngWordMap.set(key, new Set());
                    }
                    this.MissionEngWordMap.get(key)?.add(entry.word);
                }
            }
        }
    }

    public clearDB() {
        this.wordDB = [];
        this.wordSet.clear();
        this.wordThemeDB.clear();
        this.NormalStartCharSet.clear();
        this.MissionStartCharSet.clear();
        this.NormalEngStartCharSet.clear();
        this.MissionEngStartCharSet.clear();
        this.NormalWordMap.clear();
        this.MissionWordMap.clear();
        this.MissionEngWordMap.clear();
        this.NormalEngWordMap.clear();
    }

    public addWordToDB(word: string, theme: string[]) {
        const cleanWord = word.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g, '').toLowerCase();
        if (cleanWord.length <= 1 || this.wordSet.has(cleanWord)) {
            return false;
        }
        this.wordDB.push({word: cleanWord, theme});
        this.wordSet.add(cleanWord);
        this.wordThemeDB.set(cleanWord, theme);
        if (koreanRegex.test(cleanWord.charAt(0))) {
            this.NormalStartCharSet.add(cleanWord.charAt(0));
            if (!this.NormalWordMap.has(cleanWord.charAt(0))) {
                this.NormalWordMap.set(cleanWord.charAt(0), new Set());
            }
            this.NormalWordMap.get(cleanWord.charAt(0))?.add(cleanWord);
            this.NormalStartCharSet.add(cleanWord.charAt(0));
            for (const mchar of KOREAN_CHARS) {
                if (cleanWord.includes(mchar)) {
                    this.MissionStartCharSet.add([cleanWord.charAt(0), mchar]);
                    const key = this.getMissionKey(cleanWord.charAt(0), mchar);
                    if (!this.MissionWordMap.has(key)) {
                        this.MissionWordMap.set(key, new Set());
                    }
                    this.MissionWordMap.get(key)?.add(cleanWord);
                }
            }
        } else if (englishRegex.test(cleanWord.charAt(0))) {
            this.NormalEngStartCharSet.add(cleanWord.charAt(0));
            if (!this.NormalEngWordMap.has(cleanWord.charAt(0))) {
                this.NormalEngWordMap.set(cleanWord.charAt(0), new Set());
            }
            this.NormalEngWordMap.get(cleanWord.charAt(0))?.add(cleanWord);
            for (const mchar of ENGLISH_CHARS) {
                if (cleanWord.includes(mchar)) {
                    this.MissionEngStartCharSet.add([cleanWord.charAt(0), mchar]);
                    const key = this.getMissionKey(cleanWord.charAt(0), mchar);
                    if (!this.MissionEngWordMap.has(key)) {
                        this.MissionEngWordMap.set(key, new Set());
                    }
                    this.MissionEngWordMap.get(key)?.add(cleanWord);
                }
            }
        }
        return true;
    }

    public editWordInDB(oldWord: string, newWord: string) {
        const cleanOldWord = oldWord.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g, '').toLowerCase();
        const cleanNewWord = newWord.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g, '').toLowerCase();
        if (!this.wordSet.has(cleanOldWord) || cleanNewWord.length <= 1) {
            return false;
        }
        const entryIndex = this.wordDB.findIndex(entry => entry.word === cleanOldWord);
        if (entryIndex === -1) {
            return false;
        }
        const theme = this.wordDB[entryIndex].theme;
        this.wordDB[entryIndex].word = cleanNewWord;
        this.wordSet.delete(cleanOldWord);
        this.wordSet.add(cleanNewWord);
        this.wordThemeDB.delete(cleanOldWord);
        this.wordThemeDB.set(cleanNewWord, theme);

        if (englishRegex.test(cleanNewWord.charAt(0))) {
            this.NormalEngStartCharSet.add(cleanNewWord.charAt(0));
            if (!this.NormalEngWordMap.has(cleanNewWord.charAt(0))) {
                this.NormalEngWordMap.set(cleanNewWord.charAt(0), new Set());
            }
            this.NormalEngWordMap.get(cleanNewWord.charAt(0))?.add(cleanNewWord);
        } else if (koreanRegex.test(cleanNewWord.charAt(0))) {
            this.NormalStartCharSet.add(cleanNewWord.charAt(0));
            if (!this.NormalWordMap.has(cleanNewWord.charAt(0))) {
                this.NormalWordMap.set(cleanNewWord.charAt(0), new Set());
            }
            this.NormalWordMap.get(cleanNewWord.charAt(0))?.add(cleanNewWord);
        }

        if (koreanRegex.test(cleanOldWord.charAt(0))) {
            this.NormalWordMap.get(cleanOldWord.charAt(0))?.delete(cleanOldWord);
            if ((this.NormalWordMap.get(cleanOldWord.charAt(0)) ?? new Set()).size === 0) {
                this.NormalStartCharSet.delete(cleanOldWord.charAt(0));
            }
        } else if (englishRegex.test(cleanOldWord.charAt(0))) {
            this.NormalEngWordMap.get(cleanOldWord.charAt(0))?.delete(cleanOldWord);
            if ((this.NormalEngWordMap.get(cleanOldWord.charAt(0)) ?? new Set()).size === 0) {
                this.NormalEngStartCharSet.delete(cleanOldWord.charAt(0));
            }
        }
        for (const mchar of KOREAN_CHARS) {
            const key = this.getMissionKey(cleanOldWord.charAt(0), mchar);
            this.MissionWordMap.get(key)?.delete(cleanOldWord);
            if ((this.MissionWordMap.get(key) ?? new Set()).size === 0) {
                this.MissionStartCharSet.delete([cleanOldWord.charAt(0), mchar]);
            }

            const key2 = this.getMissionKey(cleanNewWord.charAt(0), mchar);
            if (cleanNewWord.includes(mchar)) {
                this.MissionStartCharSet.add([cleanNewWord.charAt(0), mchar]);
                if (!this.MissionWordMap.has(key2)) {
                    this.MissionWordMap.set(key2, new Set());
                }
                this.MissionWordMap.get(key2)?.add(cleanNewWord);
            }
        }
        for (const mchar of ENGLISH_CHARS) {
            const key = this.getMissionKey(cleanOldWord.charAt(0), mchar);
            this.MissionEngWordMap.get(key)?.delete(cleanOldWord);
            if ((this.MissionEngWordMap.get(key) ?? new Set()).size === 0) {
                this.MissionEngStartCharSet.delete([cleanOldWord.charAt(0), mchar]);
            }

            const key2 = this.getMissionKey(cleanNewWord.charAt(0), mchar);
            if (cleanNewWord.includes(mchar)) {
                this.MissionEngStartCharSet.add([cleanNewWord.charAt(0), mchar]);
                if (!this.MissionEngWordMap.has(key2)) {
                    this.MissionEngWordMap.set(key2, new Set());
                }
                this.MissionEngWordMap.get(key2)?.add(cleanNewWord);
            }
        }
        return true;
    }

    public deleteWordFromDB(word: string) {
        const cleanWord = word.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g, '').toLowerCase();
        if (!this.wordSet.has(cleanWord)) {
            return false;
        }
        this.wordDB = this.wordDB.filter(entry => entry.word !== cleanWord);
        this.wordSet.delete(cleanWord);
        this.wordThemeDB.delete(cleanWord);
        if (koreanRegex.test(cleanWord.charAt(0))) {
            this.NormalWordMap.get(cleanWord.charAt(0))?.delete(cleanWord);
            if ((this.NormalWordMap.get(cleanWord.charAt(0)) ?? new Set()).size === 0) {
                this.NormalStartCharSet.delete(cleanWord.charAt(0));
            }
        } else if (englishRegex.test(cleanWord.charAt(0))) {
            this.NormalEngWordMap.get(cleanWord.charAt(0))?.delete(cleanWord);
            if ((this.NormalEngWordMap.get(cleanWord.charAt(0)) ?? new Set()).size === 0) {
                this.NormalEngStartCharSet.delete(cleanWord.charAt(0));
            }
        }
        for (const mchar of KOREAN_CHARS) {
            const key = this.getMissionKey(cleanWord.charAt(0), mchar);
            this.MissionWordMap.get(key)?.delete(cleanWord);
            if ((this.MissionWordMap.get(key) ?? new Set()).size === 0) {
                this.MissionStartCharSet.delete([cleanWord.charAt(0), mchar]);
            }
        }
        for (const mchar of ENGLISH_CHARS) {
            const key = this.getMissionKey(cleanWord.charAt(0), mchar);
            this.MissionEngWordMap.get(key)?.delete(cleanWord);
            if ((this.MissionEngWordMap.get(key) ?? new Set()).size === 0) {
                this.MissionEngStartCharSet.delete([cleanWord.charAt(0), mchar]);
            }
        }
        return true;
    }

    public hasWord(word: string): boolean {
        return this.wordSet.has(word);
    }

    public getWordTheme(word: string): string[] {
        return this.wordThemeDB.get(word) ?? [];
    }
}

export const wordService = WordService.getInstance();