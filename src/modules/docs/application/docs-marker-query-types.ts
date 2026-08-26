/** 미션 글자 하위 문서의 표시용 갱신 정보입니다. */
export interface DocsMarker {
    character: string;
    docsId: number;
    lastUpdatedAt: string | null;
}

export type DocsMarkerSlot = DocsMarker | null;

export { isMissionParentReferenceCode } from '@/src/modules/docs/application/docs-reference-types';
