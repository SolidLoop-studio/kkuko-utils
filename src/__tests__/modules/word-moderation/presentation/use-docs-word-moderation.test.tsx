import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({
        createBrowserWordModerationServices: jest.fn(),
    }),
);

import { createBrowserWordModerationServices } from '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services';
import type { ApplicationError } from '../../../../shared/application/application-error';
import { err, ok, type Result } from '../../../../shared/application/result';
import {
    useDocsWordModeration,
    type DeleteWordDirectlyCommand,
    type DeleteWordDirectlyResult,
    type DirectWordDeletionService,
    type DocsWordModerationServices,
    type ModerateWordRequestsCommand,
    type WordRequestModerationResult,
    type WordRequestModerationService,
} from '../../../../modules/word-moderation';

const requestResult: WordRequestModerationResult = {
    processedWordRequestCount: 1,
    processedThemeChangeCount: 0,
    affectedDocsIds: [3],
};

const deletionResult: DeleteWordDirectlyResult = {
    deletedWordCount: 1,
    affectedDocsIds: [3, 7],
};

const createDeferred = <T,>() => {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve: (value: T) => resolve(value) };
};

class FakeWordRequestModerationService implements WordRequestModerationService {
    approvedCommands: ModerateWordRequestsCommand[] = [];
    rejectedCommands: ModerateWordRequestsCommand[] = [];

    approveHandler: (
        command: ModerateWordRequestsCommand,
    ) => Promise<Result<WordRequestModerationResult>> = async () => ok(requestResult);

    rejectHandler: (
        command: ModerateWordRequestsCommand,
    ) => Promise<Result<WordRequestModerationResult>> = async () => ok(requestResult);

    approve(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        this.approvedCommands.push(command);
        return this.approveHandler(command);
    }

    reject(command: ModerateWordRequestsCommand): Promise<Result<WordRequestModerationResult>> {
        this.rejectedCommands.push(command);
        return this.rejectHandler(command);
    }
}

class FakeDirectWordDeletionService implements DirectWordDeletionService {
    commands: DeleteWordDirectlyCommand[] = [];

    executeHandler: (
        command: DeleteWordDirectlyCommand,
    ) => Promise<Result<DeleteWordDirectlyResult>> = async () => ok(deletionResult);

    execute(command: DeleteWordDirectlyCommand): Promise<Result<DeleteWordDirectlyResult>> {
        this.commands.push(command);
        return this.executeHandler(command);
    }
}

const createServices = (): DocsWordModerationServices => ({
    wordRequestModerationService: new FakeWordRequestModerationService(),
    directWordDeletionService: new FakeDirectWordDeletionService(),
});

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    function QueryClientWrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return QueryClientWrapper;
};

describe('useDocsWordModeration', () => {
    beforeEach(() => {
        jest.mocked(createBrowserWordModerationServices).mockReset();
    });

    it('maps a word-request approval target to a normalized approval command', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.approve({
            kind: 'word-request',
            requestId: 5,
            requestType: 'add',
            selectedThemeIds: [4, 2],
        }));

        expect(requestService.approvedCommands).toEqual([{
            selections: [{ kind: 'word-request', requestId: 5, selectedThemeIds: [2, 4] }],
        }]);
    });

    it('maps a theme-change approval target to an approval command', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.approve({
            kind: 'theme-change',
            wordId: 11,
            themeId: 13,
            type: 'delete',
        }));

        expect(requestService.approvedCommands).toEqual([{
            selections: [{
                kind: 'theme-change',
                wordId: 11,
                changes: [{ themeId: 13, type: 'delete' }],
            }],
        }]);
    });

    it('maps a word-request rejection target to a rejection command', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject({
            kind: 'word-request',
            requestId: 17,
            requestType: 'delete',
            selectedThemeIds: [8],
        }));

        expect(requestService.rejectedCommands).toEqual([{
            selections: [{ kind: 'word-request', requestId: 17, selectedThemeIds: [8] }],
        }]);
    });

    it('maps a theme-add rejection target to the exact rejection command', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject({
            kind: 'theme-change',
            wordId: 19,
            themeId: 23,
            type: 'add',
        }));

        expect(requestService.rejectedCommands).toEqual([{
            selections: [{
                kind: 'theme-change',
                wordId: 19,
                changes: [{ themeId: 23, type: 'add' }],
            }],
        }]);
    });

    it('maps a registered-word target to a direct deletion command', async () => {
        const services = createServices();
        const deletionService = services.directWordDeletionService as FakeDirectWordDeletionService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<DeleteWordDirectlyResult> | undefined;
        await act(async () => {
            actionResult = await result.current.deleteDirectly({
                kind: 'registered-word',
                wordId: 23,
            });
        });

        expect(deletionService.commands).toEqual([{ wordId: 23 }]);
        expect(actionResult).toEqual(ok(deletionResult));
    });

    it('rejects target and action mismatches without calling a service', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const deletionService = services.directWordDeletionService as FakeDirectWordDeletionService;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.approve({
            kind: 'registered-word',
            wordId: 29,
        } as never));

        expect(requestService.approvedCommands).toEqual([]);
        expect(result.current.error).toMatchObject({ kind: 'validation', field: 'target' });

        let deletionActionResult: Result<DeleteWordDirectlyResult> | undefined;
        await act(async () => {
            deletionActionResult = await result.current.deleteDirectly({
                kind: 'theme-change',
                wordId: 31,
                themeId: 37,
                type: 'add',
            } as never);
        });

        expect(deletionService.commands).toEqual([]);
        expect(deletionActionResult).toMatchObject({
            ok: false,
            error: { kind: 'validation', field: 'target' },
        });
    });

    it('shares one pending state across every administrator action', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const deferred = createDeferred<Result<WordRequestModerationResult>>();
        requestService.approveHandler = async () => deferred.promise;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        act(() => {
            void result.current.approve({
                kind: 'word-request',
                requestId: 41,
                requestType: 'add',
                selectedThemeIds: [],
            });
        });

        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => deferred.resolve(ok(requestResult)));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('suppresses a competing same-tick action before it reaches another service', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        const deletionService = services.directWordDeletionService as FakeDirectWordDeletionService;
        const deferred = createDeferred<Result<WordRequestModerationResult>>();
        requestService.approveHandler = async () => deferred.promise;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        let approvalPromise!: Promise<Result<WordRequestModerationResult>>;
        let competingPromise!: Promise<Result<DeleteWordDirectlyResult>>;
        act(() => {
            approvalPromise = result.current.approve({
                kind: 'word-request',
                requestId: 73,
                requestType: 'add',
                selectedThemeIds: [79],
            });
            competingPromise = result.current.deleteDirectly({
                kind: 'registered-word',
                wordId: 83,
            });
        });

        let competingResult: Result<DeleteWordDirectlyResult> | undefined;
        await act(async () => {
            competingResult = await competingPromise;
        });

        expect(requestService.approvedCommands).toHaveLength(1);
        expect(deletionService.commands).toEqual([]);
        expect(competingResult).toEqual(err({
            kind: 'conflict',
            message: '문서 단어 처리가 진행 중입니다.',
        }));

        await act(async () => deferred.resolve(ok(requestResult)));
        await expect(approvalPromise).resolves.toEqual(ok(requestResult));
    });

    it('exposes failed results and clears the error explicitly', async () => {
        const services = createServices();
        const applicationError: ApplicationError = {
            kind: 'conflict',
            message: '요청 목록이 변경되었습니다.',
        };
        const deletionService = services.directWordDeletionService as FakeDirectWordDeletionService;
        deletionService.executeHandler = async () => err(applicationError);
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.deleteDirectly({
            kind: 'registered-word',
            wordId: 43,
        }));
        expect(result.current.error).toEqual(applicationError);

        act(() => result.current.clearError());
        expect(result.current.error).toBeNull();
    });

    it('clears an old error when a later administrator action starts', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        requestService.rejectHandler = async () => err({
            kind: 'validation',
            message: '요청을 확인하세요.',
        });
        const deferred = createDeferred<Result<DeleteWordDirectlyResult>>();
        const deletionService = services.directWordDeletionService as FakeDirectWordDeletionService;
        deletionService.executeHandler = async () => deferred.promise;
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.reject({
            kind: 'theme-change',
            wordId: 47,
            themeId: 53,
            type: 'add',
        }));
        expect(result.current.error).not.toBeNull();

        act(() => {
            void result.current.deleteDirectly({ kind: 'registered-word', wordId: 59 });
        });

        await waitFor(() => {
            expect(result.current.error).toBeNull();
            expect(result.current.isPending).toBe(true);
        });
        await act(async () => deferred.resolve(ok(deletionResult)));
    });

    it('converts unexpected service exceptions to one safe infrastructure error', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        requestService.approveHandler = async () => {
            throw new Error('private database detail');
        };
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        let actionResult: Result<WordRequestModerationResult> | undefined;
        await act(async () => {
            actionResult = await result.current.approve({
                kind: 'word-request',
                requestId: 61,
                requestType: 'add',
                selectedThemeIds: [67],
            });
        });

        const safeError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 단어 처리 중 오류가 발생했습니다.',
        };
        expect(actionResult).toEqual(err(safeError));
        expect(result.current.error).toEqual(safeError);
    });

    it('sanitizes a non-Error rejection, releases the guard, and allows a later retry', async () => {
        const services = createServices();
        const requestService = services.wordRequestModerationService as FakeWordRequestModerationService;
        requestService.approveHandler = async () => {
            throw { privateDetail: 'database connection string' };
        };
        const { result } = renderHook(() => useDocsWordModeration(services), {
            wrapper: createWrapper(),
        });

        let rejectedResult: Result<WordRequestModerationResult> | undefined;
        await act(async () => {
            rejectedResult = await result.current.approve({
                kind: 'word-request',
                requestId: 89,
                requestType: 'add',
                selectedThemeIds: [97],
            });
        });

        expect(rejectedResult).toEqual(err({
            kind: 'infrastructure',
            message: '문서 단어 처리 중 오류가 발생했습니다.',
        }));

        requestService.approveHandler = async () => ok(requestResult);

        let retryResult: Result<WordRequestModerationResult> | undefined;
        await act(async () => {
            retryResult = await result.current.approve({
                kind: 'word-request',
                requestId: 101,
                requestType: 'add',
                selectedThemeIds: [103],
            });
        });

        expect(retryResult).toEqual(ok(requestResult));
        expect(requestService.approvedCommands).toEqual([
            {
                selections: [{
                    kind: 'word-request',
                    requestId: 89,
                    selectedThemeIds: [97],
                }],
            },
            {
                selections: [{
                    kind: 'word-request',
                    requestId: 101,
                    selectedThemeIds: [103],
                }],
            },
        ]);
    });

    it('uses the browser-composed services when none are injected', async () => {
        const services = createServices();
        jest.mocked(createBrowserWordModerationServices).mockReturnValue(services as never);
        const { result } = renderHook(() => useDocsWordModeration(), {
            wrapper: createWrapper(),
        });

        await act(async () => result.current.deleteDirectly({
            kind: 'registered-word',
            wordId: 71,
        }));

        expect(createBrowserWordModerationServices).toHaveBeenCalled();
        expect(
            (services.directWordDeletionService as FakeDirectWordDeletionService).commands,
        ).toEqual([{ wordId: 71 }]);
    });
});
