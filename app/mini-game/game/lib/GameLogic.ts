import { duemLaw } from '@/lib/hangulUtils';
import { WordService } from '../services/WordService';
import { GameSetting, CurrentState } from '../types/game.types';

/**
 * 게임 규칙 및 로직을 처리하는 클래스
 * 순수 함수 위주로 구성하여 상태 의존성을 줄임
 */
export class GameLogic {
    /**
     * 턴 속도를 계산합니다.
     * @param roundTime 현재 라운드 시간 (ms)
     * @returns 턴 속도 (0~10)
     */
    public static getTurnSpeed(roundTime: number): number {
        if (roundTime === 0 || !isFinite(roundTime)) return 0;
        if (roundTime < 5000) return 10;
        else if (roundTime < 11000) return 9;
        else if (roundTime < 18000) return 8;
        else if (roundTime < 26000) return 7;
        else if (roundTime < 35000) return 6;
        else if (roundTime < 45000) return 5;
        else if (roundTime < 56000) return 4;
        else if (roundTime < 68000) return 3;
        else if (roundTime < 81000) return 2;
        else if (roundTime < 95000) return 1;
        else return 0;
    }

    /**
     * 단어가 유효한지 검사합니다.
     * @param word 입력된 단어
     * @param nowState 현재 게임 상태 (시작 글자 등)
     * @param wordService 단어 서비스 인스턴스
     * @returns 유효 여부
     */
    public static isValidWord(word: string, nowState: CurrentState, wordService: WordService): boolean {
        if (nowState === null) return false;
        // 두음법칙 적용 확인
        const validStartChars = [nowState.startChar, duemLaw(nowState.startChar)];
        return word.length > 1 && wordService.hasWord(word) && validStartChars.includes(word.charAt(0));
    }

    /**
     * 다음 시작 글자와 미션 글자를 결정합니다.
     * @param setting 게임 설정
     * @param wordService 단어 서비스 인스턴스
     * @param exclusion 제외할 글자 집합
     * @returns 시작 글자 및 미션 글자 객체
     */
    public static getStartChar(
        setting: GameSetting, 
        wordService: WordService, 
        exclusion: Set<string | [string, string]> = new Set()
    ): {startChar: string, missionChar: string | null} {
        let nowState: {startChar: string, missionChar: string | null} = {startChar: '', missionChar: null};

        if (setting.lang === 'ko') {
            if (setting.mode === 'normal') {
                if (setting.notAgainSameChar && exclusion.size > 0) {
                    // 교집합 구하기
                    const availableChars = new Set(
                        [...wordService.NormalStartCharSet]
                        .filter(x => setting.wantStartChar.has(x))
                        .filter(char => !(exclusion as Set<string>).has(char))
                    );
                    
                    if (availableChars.size !== 0) {
                        const randomIndex = Math.floor(Math.random() * availableChars.size);
                        const startChar = Array.from(availableChars)[randomIndex];
                        nowState = {startChar, missionChar: null};
                        return nowState;
                    }
                }
                const randomIndex = Math.floor(Math.random() * wordService.NormalStartCharSet.size);
                nowState = {startChar: Array.from(wordService.NormalStartCharSet)[randomIndex], missionChar: null};
            }
            else if (setting.mode === 'mission') {
                if (setting.notAgainSameChar && exclusion.size > 0) {
                    const availablePairs = new Set(
                        [...wordService.MissionStartCharSet]
                        .filter(pair => !(exclusion as Set<[string, string]>).has(pair) && setting.wantStartChar.has(pair[0]))
                    );
                    if (availablePairs.size !== 0) {
                        const randomIndex = Math.floor(Math.random() * availablePairs.size);
                        const [startChar, missionChar] = Array.from(availablePairs)[randomIndex];
                        nowState = {startChar, missionChar};
                        return nowState;
                    }
                }
                const randomIndex = Math.floor(Math.random() * wordService.MissionStartCharSet.size);
                const [startChar, missionChar] = Array.from(wordService.MissionStartCharSet)[randomIndex];
                nowState = {startChar, missionChar};
            }
        } else if (setting.lang === 'en') {
            if (setting.mode === 'normal') {
                if (setting.notAgainSameChar && exclusion.size > 0) {
                    const availableChars = new Set(
                        [...wordService.NormalEngStartCharSet]
                        .filter(char => !(exclusion as Set<string>).has(char))
                    );
                    if (availableChars.size !== 0) {
                        const randomIndex = Math.floor(Math.random() * availableChars.size);
                        const startChar = Array.from(availableChars)[randomIndex];
                        nowState = {startChar, missionChar: null};
                        return nowState;
                    }
                }
                const randomIndex = Math.floor(Math.random() * wordService.NormalEngStartCharSet.size);
                nowState = {startChar: Array.from(wordService.NormalEngStartCharSet)[randomIndex], missionChar: null};
            } else if (setting.mode === 'mission') {
                if (setting.notAgainSameChar && exclusion.size > 0) {
                    const availablePairs = new Set(
                        [...wordService.MissionEngStartCharSet]
                        .filter(pair => !(exclusion as Set<[string, string]>).has(pair))
                    );
                    if (availablePairs.size !== 0) {
                        const randomIndex = Math.floor(Math.random() * availablePairs.size);
                        const [startChar, missionChar] = Array.from(availablePairs)[randomIndex];
                        nowState = {startChar, missionChar};
                        return nowState;
                    }
                }
                const randomIndex = Math.floor(Math.random() * wordService.MissionEngStartCharSet.size);
                const [startChar, missionChar] = Array.from(wordService.MissionEngStartCharSet)[randomIndex];
                nowState = {startChar, missionChar};
            }
        }
        
        return nowState;
    }
}