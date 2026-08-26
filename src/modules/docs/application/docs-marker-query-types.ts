/** 미션 글자 하위 문서의 표시용 갱신 정보입니다. */
export interface DocsMarker {
    character: string;
    docsId: number;
    lastUpdatedAt: string | null;
}

export type DocsMarkerSlot = DocsMarker | null;

const missionParentReferenceCodes = [
    'ko.word-chain.mission',
    'ko.reverse-word-chain.mission',
    'ko.kkungkkungtta.mission',
] as const;

/** 불변 reference code가 지원하는 미션 글자 상위 문서인지 판별합니다. */
export const isMissionParentReferenceCode = (referenceCode: string): boolean => (
    missionParentReferenceCodes.some((candidate) => candidate === referenceCode)
);
