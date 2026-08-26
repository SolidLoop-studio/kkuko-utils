export type MissionFamily = 'word-chain' | 'reverse-word-chain' | 'kkungkkungtta';

export const MISSION_CHARACTERS = [
    '가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하',
] as const;

export const MISSION_KEYS = [
    'ga', 'na', 'da', 'ra', 'ma', 'ba', 'sa', 'a', 'ja', 'cha', 'ka', 'ta', 'pa', 'ha',
] as const;

const missionFamilies = [
    { family: 'word-chain', parentReferenceCode: 'ko.word-chain.mission', usesLastCharacter: false },
    { family: 'reverse-word-chain', parentReferenceCode: 'ko.reverse-word-chain.mission', usesLastCharacter: true },
    { family: 'kkungkkungtta', parentReferenceCode: 'ko.kkungkkungtta.mission', usesLastCharacter: false },
] as const;

export interface MissionChildReference {
    family: MissionFamily;
    character: (typeof MISSION_CHARACTERS)[number];
    characterIndex: number;
    usesLastCharacter: boolean;
}

/** 불변 reference code가 지원하는 미션 글자 상위 문서인지 판별합니다. */
export const isMissionParentReferenceCode = (referenceCode: string): boolean => (
    missionFamilies.some(({ parentReferenceCode }) => parentReferenceCode === referenceCode)
);

/** 미션 글자 상위 문서의 정렬된 하위 reference code를 반환합니다. */
export const missionChildReferenceCodes = (parentReferenceCode: string): string[] | null => {
    if (!isMissionParentReferenceCode(parentReferenceCode)) return null;

    return MISSION_KEYS.map((key) => `${parentReferenceCode}.${key}`);
};

/** 미션 글자 하위 문서 reference code를 의미 정보로 변환합니다. */
export const parseMissionChildReferenceCode = (
    referenceCode: string,
): MissionChildReference | null => {
    for (const missionFamily of missionFamilies) {
        for (const [characterIndex, key] of MISSION_KEYS.entries()) {
            if (referenceCode !== `${missionFamily.parentReferenceCode}.${key}`) continue;

            return {
                family: missionFamily.family,
                character: MISSION_CHARACTERS[characterIndex],
                characterIndex,
                usesLastCharacter: missionFamily.usesLastCharacter,
            };
        }
    }

    return null;
};
