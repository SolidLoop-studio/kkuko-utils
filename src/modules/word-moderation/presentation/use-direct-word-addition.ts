'use client';

import { useCallback, useRef, useState } from 'react';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type {
    DirectWordAdditionCommand,
    DirectWordAdditionResult,
} from '../application/direct-word-addition-types';
import { createBrowserWordModerationServices } from '../infrastructure/browser/browser-word-moderation-services';

export interface DirectWordAdditionService {
    add(command: DirectWordAdditionCommand): Promise<Result<DirectWordAdditionResult>>;
}

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 추가 처리 중 오류가 발생했습니다.',
});

/** 직접 단어 추가의 중복 제출과 안정적인 오류 상태를 관리합니다. */
export function useDirectWordAddition(service?: DirectWordAdditionService) {
    const [resolvedService] = useState<DirectWordAdditionService>(() => (
        service ?? createBrowserWordModerationServices().directWordAdditionService
    ));
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<ApplicationError | null>(null);
    const pendingPromise = useRef<Promise<Result<DirectWordAdditionResult>> | null>(null);

    const addDirectly = useCallback((command: DirectWordAdditionCommand) => {
        if (pendingPromise.current !== null) return pendingPromise.current;

        setIsPending(true);
        setError(null);
        const action = (async () => {
            try {
                const result = await resolvedService.add(command);
                if (!result.ok) setError(result.error);
                return result;
            } catch {
                const safeError = infrastructureError();
                setError(safeError);
                return err<DirectWordAdditionResult>(safeError);
            } finally {
                pendingPromise.current = null;
                setIsPending(false);
            }
        })();
        pendingPromise.current = action;
        return action;
    }, [resolvedService]);

    return {
        addDirectly,
        isPending,
        error,
        clearError: () => setError(null),
    };
}
