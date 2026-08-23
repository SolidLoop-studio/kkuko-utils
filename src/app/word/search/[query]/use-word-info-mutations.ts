'use client';

import { useRef } from 'react';

import {
    type RequestWordThemeChangesCommand,
    type RequestWordThemeChangesResult,
    type UserWordRequestCommand,
    type UserWordRequestResult,
    type UserWordRequestService,
    type UserWordThemeRequestService,
    useUserWordRequests,
    useUserWordThemeRequests,
} from '@/src/modules/word-requests';
import {
    type DeleteWordDirectlyResult,
    type DocsWordModerationServices,
    useDocsWordModeration,
} from '@/src/modules/word-moderation';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';

export type WordInfoMutationServices = {
    userWordRequestService?: UserWordRequestService;
    userWordThemeRequestService?: UserWordThemeRequestService;
    docsWordModerationServices?: DocsWordModerationServices;
};

const concurrentActionError = (): ApplicationError => ({
    kind: 'conflict',
    message: '단어 요청 처리가 진행 중입니다.',
});

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '단어 요청 처리 중 오류가 발생했습니다.',
});

/** 단어 정보 화면의 요청과 직접 삭제 작업을 하나의 실행 잠금으로 조율합니다. */
export function useWordInfoMutations(services?: WordInfoMutationServices): {
    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    cancelRequest(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>>;
    requestThemeChanges(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>>;
    deleteDirectly(wordId: number): Promise<Result<DeleteWordDirectlyResult>>;
    isPending: boolean;
} {
    const userWordRequests = useUserWordRequests(services?.userWordRequestService);
    const userWordThemeRequests = useUserWordThemeRequests(services?.userWordThemeRequestService);
    const docsWordModeration = useDocsWordModeration(services?.docsWordModerationServices);
    const isInvokingRef = useRef(false);

    const invoke = async <T,>(
        operation: () => Promise<Result<T>>,
    ): Promise<Result<T>> => {
        if (isInvokingRef.current) {
            return err(concurrentActionError());
        }

        isInvokingRef.current = true;
        try {
            return await operation();
        } catch {
            return err(infrastructureError());
        } finally {
            isInvokingRef.current = false;
        }
    };

    return {
        requestDeletion: (command) => invoke(() => userWordRequests.requestDeletion(command)),
        cancelRequest: (command) => invoke(() => userWordRequests.cancel(command)),
        requestThemeChanges: (command) => invoke(() => (
            userWordThemeRequests.requestThemeChanges(command)
        )),
        deleteDirectly: (wordId) => invoke(() => docsWordModeration.deleteDirectly({
            kind: 'registered-word',
            wordId,
        })),
        isPending: (
            userWordRequests.isPending
            || userWordThemeRequests.isPending
            || docsWordModeration.isPending
        ),
    };
}
