import { GameMode } from './types';

export const getModeLabel = (m: GameMode) => {
    switch (m) {
        case 'kor-start': return '한국어 끝말잇기';
        case 'kor-end': return '한국어 앞말잇기';
        case 'kung': return '쿵쿵따';
        case 'hunmin': return '훈민정음';
        case 'jaqi': return '자음퀴즈';
    }
};

export const countMissionChars = (word: string, missionChars: string) => {
    if (!missionChars) return 0;
    return word.split('').filter(char => missionChars.includes(char)).length;
};
