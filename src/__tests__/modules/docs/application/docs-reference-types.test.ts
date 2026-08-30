import {
    MISSION_CHARACTERS,
    MISSION_KEYS,
    isMissionParentReferenceCode,
    missionChildReferenceCodes,
    parseMissionChildReferenceCode,
} from '@/src/modules/docs/application/docs-reference-types';

const missionFamilies = [
    {
        family: 'word-chain',
        parentReferenceCode: 'ko.word-chain.mission',
        usesLastCharacter: false,
    },
    {
        family: 'reverse-word-chain',
        parentReferenceCode: 'ko.reverse-word-chain.mission',
        usesLastCharacter: true,
    },
    {
        family: 'kkungkkungtta',
        parentReferenceCode: 'ko.kkungkkungtta.mission',
        usesLastCharacter: false,
    },
] as const;

describe('mission reference catalog', () => {
    it.each(missionFamilies)('recognizes canonical parent $parentReferenceCode', ({ parentReferenceCode }) => {
        expect(isMissionParentReferenceCode(parentReferenceCode)).toBe(true);
    });

    it.each(['ko.custom.mission', 'ko.word-chain.mission.ga', ''])('rejects non-parent reference %s', (referenceCode) => {
        expect(isMissionParentReferenceCode(referenceCode)).toBe(false);
        expect(missionChildReferenceCodes(referenceCode)).toBeNull();
    });

    it.each(missionFamilies)('returns the fourteen canonical children for $parentReferenceCode', ({ parentReferenceCode }) => {
        expect(missionChildReferenceCodes(parentReferenceCode)).toEqual(
            MISSION_KEYS.map((key) => `${parentReferenceCode}.${key}`),
        );
    });

    it.each(missionFamilies.flatMap(({ family, parentReferenceCode, usesLastCharacter }) => (
        MISSION_KEYS.map((key, characterIndex) => [
            `${parentReferenceCode}.${key}`,
            {
                family,
                character: MISSION_CHARACTERS[characterIndex],
                characterIndex,
                usesLastCharacter,
            },
        ] as const)
    )))('parses canonical child %s exactly', (referenceCode, expected) => {
        expect(parseMissionChildReferenceCode(referenceCode)).toEqual(expected);
    });

    it.each([
        'ko.word-chain.mission',
        'ko.reverse-word-chain.mission',
        'ko.kkungkkungtta.mission',
        'ko.word-chain.mission.unknown',
        'ko.word-chain.mission.ga.extra',
        'ko.custom.mission.ga',
        '',
        '209',
    ])('returns null for non-child reference %s', (referenceCode) => {
        expect(parseMissionChildReferenceCode(referenceCode)).toBeNull();
    });
});
