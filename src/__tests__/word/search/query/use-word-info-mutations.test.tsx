import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import * as wordModerationModule from '@/src/modules/word-moderation';
import * as wordRequestsModule from '@/src/modules/word-requests';

jest.mock(
    '../../../../modules/word-requests/infrastructure/browser/browser-word-request-services',
    () => ({
        createBrowserWordRequestServices: jest.fn(),
    }),
);

jest.mock(
    '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({
        createBrowserWordModerationServices: jest.fn(),
    }),
);

jest.mock('../../../../modules/word-requests', () => {
    const actual = jest.requireActual<typeof import('../../../../modules/word-requests')>(
        '../../../../modules/word-requests',
    );

    return {
        ...actual,
        useUserWordRequests: jest.fn(actual.useUserWordRequests),
    };
});

jest.mock('../../../../modules/word-moderation', () => {
    const actual = jest.requireActual<typeof import('../../../../modules/word-moderation')>(
        '../../../../modules/word-moderation',
    );

    return {
        ...actual,
        useDocsWordModeration: jest.fn(actual.useDocsWordModeration),
    };
});

import {
    type RequestWordThemeChangesCommand,
    type RequestWordThemeChangesResult,
    type UserWordRequestCommand,
    type UserWordRequestResult,
    type UserWordRequestService,
    type UserWordThemeRequestService,
} from '@/src/modules/word-requests';
import {
    type DeleteWordDirectlyCommand,
    type DeleteWordDirectlyResult,
    type DirectWordDeletionService,
    type DocsWordModerationServices,
    type ModerateWordRequestsCommand,
    type WordRequestModerationResult,
    type WordRequestModerationService,
} from '@/src/modules/word-moderation';
import { err, ok, type Result } from '@/src/shared/application/result';

import {
    type WordInfoMutationServices,
    useWordInfoMutations,
} from '@/src/app/word/search/[query]/use-word-info-mutations';

const deletionCommand: UserWordRequestCommand = { word: '나비' };
const cancellationCommand: UserWordRequestCommand = { word: '가방' };
const themeCommand: RequestWordThemeChangesCommand = {
    word: '나비',
    changes: [{ themeCode: 'animal', type: 'add' }],
};

const deletionResult: UserWordRequestResult = {
    requestId: 11,
    word: '나비',
    requestType: 'delete',
};
const cancellationResult: UserWordRequestResult = {
    requestId: 12,
    word: '가방',
    requestType: 'add',
};
const themeResult: RequestWordThemeChangesResult = {
    word: '나비',
    changes: [{ themeCode: 'animal', themeName: '동물', type: 'add' }],
};
const directDeletionResult: DeleteWordDirectlyResult = {
    deletedWordCount: 1,
    affectedDocsIds: [3, 7],
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

class FakeUserWordRequestService implements UserWordRequestService {
    deletionCommands: UserWordRequestCommand[] = [];
    cancellationCommands: UserWordRequestCommand[] = [];

    requestDeletionHandler: (
        command: UserWordRequestCommand,
    ) => Promise<Result<UserWordRequestResult>> = async () => ok(deletionResult);

    cancellationHandler: (
        command: UserWordRequestCommand,
    ) => Promise<Result<UserWordRequestResult>> = async () => ok(cancellationResult);

    requestDeletion(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        this.deletionCommands.push(command);
        return this.requestDeletionHandler(command);
    }

    cancel(command: UserWordRequestCommand): Promise<Result<UserWordRequestResult>> {
        this.cancellationCommands.push(command);
        return this.cancellationHandler(command);
    }
}

class FakeUserWordThemeRequestService implements UserWordThemeRequestService {
    commands: RequestWordThemeChangesCommand[] = [];

    executeHandler: (
        command: RequestWordThemeChangesCommand,
    ) => Promise<Result<RequestWordThemeChangesResult>> = async () => ok(themeResult);

    execute(
        command: RequestWordThemeChangesCommand,
    ): Promise<Result<RequestWordThemeChangesResult>> {
        this.commands.push(command);
        return this.executeHandler(command);
    }
}

class FakeWordRequestModerationService implements WordRequestModerationService {
    async approve(_command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return ok({
            processedWordRequestCount: 0,
            processedThemeChangeCount: 0,
            affectedDocsIds: [],
        });
    }

    async reject(_command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        return ok({
            processedWordRequestCount: 0,
            processedThemeChangeCount: 0,
            affectedDocsIds: [],
        });
    }
}

class FakeDirectWordDeletionService implements DirectWordDeletionService {
    commands: DeleteWordDirectlyCommand[] = [];

    executeHandler: (
        command: DeleteWordDirectlyCommand,
    ) => Promise<Result<DeleteWordDirectlyResult>> = async () => ok(directDeletionResult);

    execute(command: DeleteWordDirectlyCommand): Promise<Result<DeleteWordDirectlyResult>> {
        this.commands.push(command);
        return this.executeHandler(command);
    }
}

const createServices = () => {
    const userWordRequestService = new FakeUserWordRequestService();
    const userWordThemeRequestService = new FakeUserWordThemeRequestService();
    const directWordDeletionService = new FakeDirectWordDeletionService();
    const docsWordModerationServices: DocsWordModerationServices = {
        wordRequestModerationService: new FakeWordRequestModerationService(),
        directWordDeletionService,
    };
    const services: WordInfoMutationServices = {
        userWordRequestService,
        userWordThemeRequestService,
        docsWordModerationServices,
    };

    return {
        services,
        userWordRequestService,
        userWordThemeRequestService,
        directWordDeletionService,
    };
};

const renderWordInfoMutations = (services: WordInfoMutationServices) => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    function QueryClientWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return renderHook(() => useWordInfoMutations(services), { wrapper: QueryClientWrapper });
};

describe('useWordInfoMutations', () => {
    it('forwards an exact deletion command and returns its result', async () => {
        const { services, userWordRequestService } = createServices();
        const { result } = renderWordInfoMutations(services);

        let actionResult!: Result<UserWordRequestResult>;
        await act(async () => {
            actionResult = await result.current.requestDeletion(deletionCommand);
        });

        expect(actionResult).toEqual(ok(deletionResult));
        expect(userWordRequestService.deletionCommands).toEqual([deletionCommand]);
    });

    it('forwards an exact cancellation command and returns its result', async () => {
        const { services, userWordRequestService } = createServices();
        const { result } = renderWordInfoMutations(services);

        let actionResult!: Result<UserWordRequestResult>;
        await act(async () => {
            actionResult = await result.current.cancelRequest(cancellationCommand);
        });

        expect(actionResult).toEqual(ok(cancellationResult));
        expect(userWordRequestService.cancellationCommands).toEqual([cancellationCommand]);
    });

    it('forwards an exact theme-change command and returns its result', async () => {
        const { services, userWordThemeRequestService } = createServices();
        const { result } = renderWordInfoMutations(services);

        let actionResult!: Result<RequestWordThemeChangesResult>;
        await act(async () => {
            actionResult = await result.current.requestThemeChanges(themeCommand);
        });

        expect(actionResult).toEqual(ok(themeResult));
        expect(userWordThemeRequestService.commands).toEqual([themeCommand]);
    });

    it('deletes a registered word directly using its exact word id', async () => {
        const { services, directWordDeletionService } = createServices();
        const { result } = renderWordInfoMutations(services);

        let actionResult!: Result<DeleteWordDirectlyResult>;
        await act(async () => {
            actionResult = await result.current.deleteDirectly(23);
        });

        expect(actionResult).toEqual(ok(directDeletionResult));
        expect(directWordDeletionService.commands).toEqual([{ wordId: 23 }]);
    });

    it('passes the exact registered-word target to the composed moderation hook', async () => {
        const { services } = createServices();
        const deleteDirectly = jest.fn().mockResolvedValue(ok(directDeletionResult));
        jest.mocked(wordModerationModule.useDocsWordModeration).mockReturnValueOnce({
            approve: async () => ok({
                processedWordRequestCount: 0,
                processedThemeChangeCount: 0,
                affectedDocsIds: [],
            }),
            reject: async () => ok({
                processedWordRequestCount: 0,
                processedThemeChangeCount: 0,
                affectedDocsIds: [],
            }),
            deleteDirectly,
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        const { result } = renderWordInfoMutations(services);

        await act(async () => result.current.deleteDirectly(29));

        expect(deleteDirectly).toHaveBeenCalledWith({
            kind: 'registered-word',
            wordId: 29,
        });
    });

    it('is pending while a composed action remains unresolved', async () => {
        const deferred = createDeferred<Result<UserWordRequestResult>>();
        const { services, userWordRequestService } = createServices();
        userWordRequestService.requestDeletionHandler = async () => deferred.promise;
        const { result } = renderWordInfoMutations(services);

        let actionPromise!: Promise<Result<UserWordRequestResult>>;
        act(() => {
            actionPromise = result.current.requestDeletion(deletionCommand);
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => deferred.resolve(ok(deletionResult)));
        await expect(actionPromise).resolves.toEqual(ok(deletionResult));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('rejects a competing action before its service is called', async () => {
        const deferred = createDeferred<Result<UserWordRequestResult>>();
        const { services, userWordRequestService, userWordThemeRequestService } = createServices();
        userWordRequestService.requestDeletionHandler = async () => deferred.promise;
        const { result } = renderWordInfoMutations(services);

        let deletionPromise!: Promise<Result<UserWordRequestResult>>;
        let competingPromise!: Promise<Result<RequestWordThemeChangesResult>>;
        act(() => {
            deletionPromise = result.current.requestDeletion(deletionCommand);
            competingPromise = result.current.requestThemeChanges(themeCommand);
        });

        await expect(competingPromise).resolves.toEqual(err({
            kind: 'conflict',
            message: '단어 요청 처리가 진행 중입니다.',
        }));
        expect(userWordThemeRequestService.commands).toEqual([]);

        await act(async () => deferred.resolve(ok(deletionResult)));
        await expect(deletionPromise).resolves.toEqual(ok(deletionResult));
    });

    it('preserves returned application errors and releases the lock for a later action', async () => {
        const returnedError = {
            kind: 'conflict' as const,
            message: '이미 처리된 요청입니다.',
        };
        const { services, userWordRequestService } = createServices();
        userWordRequestService.requestDeletionHandler = async () => err(returnedError);
        const { result } = renderWordInfoMutations(services);

        let failedResult!: Result<UserWordRequestResult>;
        let retryResult!: Result<UserWordRequestResult>;
        await act(async () => {
            failedResult = await result.current.requestDeletion(deletionCommand);
            retryResult = await result.current.cancelRequest(cancellationCommand);
        });

        expect(failedResult).toEqual(err(returnedError));
        expect(retryResult).toEqual(ok(cancellationResult));
        expect(userWordRequestService.cancellationCommands).toEqual([cancellationCommand]);
    });

    it('converts a thrown dependency to a safe error and releases the lock for a later action', async () => {
        const { services, userWordRequestService } = createServices();
        userWordRequestService.requestDeletionHandler = async () => {
            throw new Error('private database implementation detail');
        };
        const { result } = renderWordInfoMutations(services);

        let failedResult!: Result<UserWordRequestResult>;
        let retryResult!: Result<UserWordRequestResult>;
        await act(async () => {
            failedResult = await result.current.requestDeletion(deletionCommand);
            retryResult = await result.current.cancelRequest(cancellationCommand);
        });

        expect(failedResult).toEqual(err({
            kind: 'infrastructure',
            message: '단어 요청 처리 중 오류가 발생했습니다.',
        }));
        expect(retryResult).toEqual(ok(cancellationResult));
        expect(userWordRequestService.cancellationCommands).toEqual([cancellationCommand]);
    });

    it('sanitizes a rejected composed action and releases the lock for a later action', async () => {
        const { services } = createServices();
        const cancel = jest.fn().mockResolvedValue(ok(cancellationResult));
        jest.mocked(wordRequestsModule.useUserWordRequests).mockReturnValueOnce({
            requestDeletion: jest.fn().mockRejectedValue({ privateDetail: 'connection string' }),
            cancel,
            isPending: false,
            error: null,
            clearError: jest.fn(),
        });
        const { result } = renderWordInfoMutations(services);

        let failedResult!: Result<UserWordRequestResult>;
        let retryResult!: Result<UserWordRequestResult>;
        await act(async () => {
            failedResult = await result.current.requestDeletion(deletionCommand);
            retryResult = await result.current.cancelRequest(cancellationCommand);
        });

        expect(failedResult).toEqual(err({
            kind: 'infrastructure',
            message: '단어 요청 처리 중 오류가 발생했습니다.',
        }));
        expect(retryResult).toEqual(ok(cancellationResult));
        expect(cancel).toHaveBeenCalledWith(cancellationCommand);
    });
});
