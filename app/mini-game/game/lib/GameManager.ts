import { disassemble } from 'es-hangul';
import type { GameSetting, SubminWordResult, CurrentState, UsedWord } from '../types/game.types';
import { wordService } from '../services/WordService';
import { GameLogic } from './GameLogic';

/**
 * 게임 진행 상태 및 로직을 관리하는 매니저 클래스
 */
class GameManager {
    private static instance: GameManager;

    private gameSetting: GameSetting = {
        lang: 'ko', 
        mode: 'normal', 
        hintMode: 'auto', 
        notAgainSameChar: false, 
        roundTime: 60000, 
        wantStartChar: new Set()
    };
    
    private nowState: CurrentState = null;
    private usedWords: UsedWord[] = [];
    private exclusionSet: Set<string | [string, string]> = new Set();

    private hintStack: number = 0;
    private hintWord: string = "";
    private revealedIndices = new Set<number>();

    private constructor() {
        if (GameManager.instance) {
            throw new Error('GameManager is a singleton class. Use GameManager.getInstance() to access the instance.');
        }
        GameManager.instance = this;
    }

    /**
     * 싱글톤 인스턴스를 반환합니다.
     * 
     * @returns GameManager 인스턴스
     */
    public static getInstance() {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    /**
     * 게임 설정을 업데이트합니다.
     * 
     * @param setting - 업데이트할 게임 설정 객체
     */
    public updateSetting(setting: Partial<GameSetting>) {
        this.gameSetting = {...this.gameSetting, ...setting};
    }

    /**
     * 현재 게임 설정을 반환합니다.
     * 
     * @returns 현재 게임 설정 객체
     */
    public getSetting(): GameSetting {
        return this.gameSetting;
    }

    /**
     * 게임 시작 가능 여부를 확인합니다.
     * 
     * @returns 게임 시작 가능 여부
     */
    public canGameStart(): boolean {
        if (this.gameSetting.lang === 'ko') {
            if (this.gameSetting.mode === 'normal') {
                return wordService.NormalStartCharSet.size > 0;
            } else if (this.gameSetting.mode === 'mission') {
                return wordService.MissionStartCharSet.size > 0;
            }
        } else if (this.gameSetting.lang === 'en') {
            if (this.gameSetting.mode === 'normal') {
                return wordService.NormalEngStartCharSet.size > 0;
            } else if (this.gameSetting.mode === 'mission') {
                return wordService.MissionEngStartCharSet.size > 0;
            }
        }
        return false;
    }

    /**
     * 단어 DB를 로드하고 게임 설정을 업데이트합니다.
     * 
     * @param data - 단어 데이터 배열
     * @param setting - 업데이트할 게임 설정 객체
     */
    public loadWordDB(data: {word: string, theme: string[]}[], setting: Partial<GameSetting>) {
        wordService.loadWordDB(data);
        this.updateSetting(setting);
    }

    /**
     * 단어 DB를 초기화합니다.
     */
    public clearDB() {
        wordService.clearDB();
    }

    /**
     * 단어를 DB에 추가합니다.
     * 
     * @param word - 추가할 단어 
     * @param theme - 단어의 주제 배열
     * @returns 추가 작업의 성공 여부
     */
    public addWordToDB(word: string, theme: string[]) {
        return wordService.addWordToDB(word, theme);
    }

    /**
     * 단어를 DB에서 수정합니다.
     * 
     * @param oldWord - 수정할 기존 단어
     * @param newWord - 새로운 단어
     * @returns 수정 작업의 성공 여부
     */
    public editWordInDB(oldWord: string, newWord: string) {
        return wordService.editWordInDB(oldWord, newWord);
    }

    /**
     * 단어를 DB에서 삭제합니다.
     * 
     * @param word - 삭제할 단어
     * @returns 삭제 작업의 성공 여부
     */
    public deleteWordFromDB(word: string) {
        return wordService.deleteWordFromDB(word);
    }

    /**
     * 단어의 유효성을 검사합니다.
     * 
     * @param word - 검사할 단어
     * @returns 단어의 유효성 여부
     */
    public isValidWord(word: string): boolean {
        return GameLogic.isValidWord(word, this.nowState, wordService);
    }

    /**
     * 단어의 주제를 반환합니다.
     * 
     * @param word - 주제를 조회할 단어
     * @returns 단어의 주제 배열
     */
    public getWordTheme(word: string): string[] {
        return wordService.getWordTheme(word);
    }
    
    /**
     * 턴 속도를 계산합니다.
     * 
     * @param roundTime - 현재 라운드 시간
     * @returns 턴 속도
     */
    public getTurnSpeed(roundTime: number): number {
        return GameLogic.getTurnSpeed(roundTime);
    }

    /**
     * 다음 시작 글자와 미션 글자를 결정합니다.
     * 
     * @param exclusion - 제외할 글자 집합
     * @returns 시작 글자 및 미션 글자 객체
     */
    public getStartChar(exclusion: Set<string | [string, string]> = new Set()): {startChar: string, missionChar: string | null}  {
        const result = GameLogic.getStartChar(this.gameSetting, wordService, exclusion);
        this.nowState = result;
        return result;
    }

    /**
     * 현재 게임 상태를 반환합니다.
     * 
     * @returns 현재 게임 상태 객체
     */
    public getCurrentState() {
        return this.nowState;
    }

    /**
     * 게임을 시작합니다.
     * 
     * @returns 초기 게임 상태 및 턴 정보 객체
     */
    public gameStart(){
        this.nowState = null;
        this.hintStack = 0;
        this.hintWord = "";
        this.revealedIndices.clear();
        this.exclusionSet.clear();
        
        const nextSpeed = this.getTurnSpeed(this.gameSetting.roundTime);
        let nextTrunTime = 15000 - 1400 * nextSpeed;
        this.usedWords = [];
        
        if (this.gameSetting.roundTime === 0 || !isFinite(this.gameSetting.roundTime)) {
            nextTrunTime = Infinity;
        }
        
        const startState = this.getStartChar();
        return {...startState, turnTime: nextTrunTime, turnSpeed: nextSpeed};
    }

    /**
     * 단어를 제출하고 게임 상태를 업데이트합니다.
     * 
     * @param word - 제출된 단어
     * @param roundTime - 현재 라운드 시간
     * @returns 제출 결과 객체
     */
    public submitWord(word: string, roundTime: number): SubminWordResult {
        const startChar = this.nowState ? this.nowState.startChar : '';
        const missionChar = this.nowState ? this.nowState.missionChar : null;
        
        if (!this.isValidWord(word) || this.nowState === null) {
            return {ok: false, reason: ""};
        } else if (this.gameSetting.mode === "mission" && this.nowState.missionChar && !word.includes(this.nowState.missionChar)) {
            return {ok: false, reason: "미션 글자 미포함!"};
        } else {
            const wordTheme = this.getWordTheme(word);
            const wordEntry = {word, theme: wordTheme};
            
            if (this.gameSetting.notAgainSameChar) {
                this.exclusionSet.add(this.gameSetting.mode === 'normal' ? word.charAt(0) : [word.charAt(0), this.nowState!.missionChar!]);
            }
            
            const nextSpeed = this.getTurnSpeed(roundTime);
            const nextTrunTime = 15000 - 1400 * nextSpeed;
            
            const {startChar: nextChar, missionChar: nextMissionChar} = this.getStartChar(this.exclusionSet);
            
            if (this.gameSetting.notAgainSameChar) {
                this.exclusionSet.add(this.gameSetting.mode === 'normal' ? nextChar : [nextChar, nextMissionChar!]);
            }
            
            const usedHintCount = this.hintStack;
            this.hintStack = 0;
            this.hintWord = "";
            this.revealedIndices.clear();
            
            const actualTrunTime = (roundTime === 0 || !isFinite(roundTime)) ? Infinity : Math.min(roundTime, nextTrunTime + 100);
            
            this.usedWords.push({char: startChar, word, missionChar: missionChar, useHintCount: usedHintCount});
            
            return {ok: true, wordEntry, nextChar, nextMissionChar, turnSpeed: nextSpeed, trunTime: actualTrunTime};
        }
    }

    /**
     * 힌트 단어를 생성합니다.
     * 
     * @returns 힌트 단어 문자열
     */
    public getHint(){
        if (this.nowState === null) return "";
        
        if (this.gameSetting.hintMode === 'auto') {
            if (this.gameSetting.mode === 'normal') {
                const hintWords = Array.from(wordService.NormalWordMap.get(this.nowState.startChar) || []);
                if (hintWords.length > 0) {
                    const randomIndex = Math.floor(Math.random() * hintWords.length);
                    return `${hintWords[randomIndex]}`;
                }
            } else if (this.gameSetting.mode === 'mission') {
                const key = wordService.getMissionKey(this.nowState.startChar, this.nowState.missionChar!);
                const hintWords = Array.from(wordService.MissionWordMap.get(key) || []);
                if (hintWords.length > 0) {
                    const randomIndex = Math.floor(Math.random() * hintWords.length);
                    return `${hintWords[randomIndex]}`;
                }
            }
        } else {
            if (this.gameSetting.mode === 'normal') {
                const hintWords = Array.from(wordService.NormalWordMap.get(this.nowState.startChar) || []);
                if (hintWords.length > 0) {
                    const longestWord = hintWords.reduce((a, b) => a.length >= b.length ? a : b, "");
                    return `${longestWord}`;
                }
            } else if (this.gameSetting.mode === 'mission') {
                const hintWords = Array.from(wordService.MissionWordMap.get(wordService.getMissionKey(this.nowState.startChar, this.nowState.missionChar!)) || []);
                if (hintWords.length > 0) {
                    const manyIncludeWord = hintWords.reduce((a, b) => {
                        const aCount = a.split(this.nowState!.missionChar!).length - 1;
                        const bCount = b.split(this.nowState!.missionChar!).length - 1;
                        if (aCount !== bCount) {
                            return aCount >= bCount ? a : b;
                        } else {
                            return a.length >= b.length ? a : b;
                        }
                    }, "");
                    return `${manyIncludeWord}`;
                }
            }
        }
        return "";
    }

    /**
     * 게임 종료 힌트를 반환합니다.
     * 
     * @returns 힌트 단어 문자열
     */
    public gameEndHint() {
        if (this.hintWord) return this.hintWord;
        this.hintWord = this.getHint();
        return this.hintWord;
    }

    /**
     * 힌트 단어를 반환합니다.
     * 
     * @returns 힌트 단어 문자열
     */
    public getHintWord() {
        if (this.nowState === null) return null;
        if (this.hintStack === 0) {
            this.hintWord = this.getHint();
        }

        let currentHint = '';
        const wordLength = this.hintWord.length;

        const revealRandomIndices = (targetCount: number) => {
            let revealedCount = this.revealedIndices.size;
            while (revealedCount < targetCount) {
                const randomIndex = Math.floor(Math.random() * wordLength);
                if (!this.revealedIndices.has(randomIndex)) {
                    this.revealedIndices.add(randomIndex);
                    revealedCount++;
                }
            }
        };

        if (this.hintStack === 0) {
            for (let i = 0; i < wordLength; i++) {
                currentHint += disassemble(this.hintWord[i])[0];
            }
        } else if (this.hintStack === 1) {
            const maxRevealCount = Math.floor(wordLength / 3);
            revealRandomIndices(maxRevealCount);
            for (let i = 0; i < wordLength; i++) {
                if (this.revealedIndices.has(i)) {
                    currentHint += this.hintWord[i];
                } else {
                    currentHint += disassemble(this.hintWord[i])[0];
                }
            }
        } else if (this.hintStack === 2) {
            const maxRevealCount = Math.floor(wordLength / 2);
            revealRandomIndices(maxRevealCount);
            for (let i = 0; i < wordLength; i++) {
                if (this.revealedIndices.has(i)) {
                    currentHint += this.hintWord[i];
                } else {
                    currentHint += disassemble(this.hintWord[i])[0];
                }
            }
        } else if (this.hintStack === 3) {
            const maxRevealCount = Math.floor((wordLength * 2) / 3);
            revealRandomIndices(maxRevealCount);
            for (let i = 0; i < wordLength; i++) {
                if (this.revealedIndices.has(i)) {
                    currentHint += this.hintWord[i];
                } else {
                    currentHint += disassemble(this.hintWord[i])[0];
                }
            }
        } else if (this.hintStack >= 4) {
            currentHint = this.hintWord;
        } else {
            const maxRevealCount = Math.floor(wordLength / 2);
            revealRandomIndices(maxRevealCount);
            for (let i = 0; i < wordLength; i++) {
                if (this.revealedIndices.has(i)) {
                    currentHint += this.hintWord[i];
                } else {
                    currentHint += disassemble(this.hintWord[i])[0];
                }
            }
        }
        this.hintStack++;

        return currentHint;
    }

    /**
     * 게임을 종료합니다.
     * 
     * @returns 종료된 게임의 사용된 단어 배열
     */
    public gameEnd() {
        if (!this.usedWords[0]?.isFailed) {
            this.usedWords.push({char: this.nowState ? this.nowState.startChar : '', word: this.hintWord, missionChar: this.nowState ? this.nowState.missionChar : null, useHintCount: this.hintStack, isFailed: true});
        }
        return { usedWords: this.usedWords }
    }
}

const gameManager = GameManager.getInstance();

export default gameManager;