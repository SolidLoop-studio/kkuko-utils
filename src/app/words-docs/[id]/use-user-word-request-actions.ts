import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
    useUserWordRequests,
    type UserWordRequestService,
} from '@/src/modules/word-requests';
import type { ApplicationError } from '@/src/shared/application/application-error';
import type { Result } from '@/src/shared/application/result';
import type { UserWordRequestResult } from '@/src/modules/word-requests';

type UseUserWordRequestActionsOptions = {
    makeError(error: ApplicationError): void;
    setIsProcessing: Dispatch<SetStateAction<boolean>>;
    completeWork(): void | Promise<void>;
    isProcessing: boolean;
    service?: UserWordRequestService;
};

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 처리 중 오류가 발생했습니다.',
});

/** 문서 단어 화면의 사용자 요청 생성·취소 동작을 제공합니다. */
export function useUserWordRequestActions({
    makeError,
    setIsProcessing,
    completeWork,
    isProcessing,
    service,
}: UseUserWordRequestActionsOptions) {
    const {
        requestDeletion,
        cancel,
        isPending,
    } = useUserWordRequests(service);
    const isActionInFlightRef = useRef(false);

    const runAction = useCallback(async (action: () => Promise<Result<UserWordRequestResult>>) => {
        if (isProcessing || isPending || isActionInFlightRef.current) return;

        isActionInFlightRef.current = true;
        setIsProcessing(true);
        let hasSucceeded = false;
        try {
            const result = await action();
            if (!result.ok) {
                makeError(result.error);
                return;
            }

            hasSucceeded = true;
        } catch {
            makeError(infrastructureError());
        } finally {
            isActionInFlightRef.current = false;
            setIsProcessing(false);
        }

        if (hasSucceeded) await completeWork();
    }, [completeWork, isPending, isProcessing, makeError, setIsProcessing]);

    const requestDelete = useCallback(
        async (word: string) => runAction(() => requestDeletion({ word })),
        [requestDeletion, runAction],
    );
    const cancelAddRequest = useCallback(
        async (word: string) => runAction(() => cancel({ word })),
        [cancel, runAction],
    );
    const cancelDeleteRequest = useCallback(
        async (word: string) => runAction(() => cancel({ word })),
        [cancel, runAction],
    );

    return {
        requestDelete,
        cancelAddRequest,
        cancelDeleteRequest,
    };
}
