'use client';

import { useCallback, useState } from 'react';

import type { RecordDocsViewService } from '../application/record-docs-view';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';

export type DocsViewCommandService = Pick<RecordDocsViewService, 'record'>;

/** 성공적으로 렌더링한 문서의 조회 수를 페이지 흐름과 독립적으로 기록합니다. */
export const useRecordDocsView = (): { record(docsId: number): Promise<void> } => {
    const [service] = useState<DocsViewCommandService>(() => (
        createBrowserDocsServices().docsViewCommandService
    ));

    const record = useCallback(async (docsId: number): Promise<void> => {
        try {
            await service.record(docsId);
        } catch {
            // 조회 수 기록은 렌더링 성공을 방해하지 않는 best-effort 명령입니다.
        }
    }, [service]);

    return { record };
};
