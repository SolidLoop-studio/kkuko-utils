import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren, SetStateAction } from 'react';

jest.mock(
    '../../../modules/word-requests/infrastructure/browser/browser-word-request-services',
    () => ({ createBrowserWordRequestServices: jest.fn() }),
);

import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';
import type { UserWordRequestResult, UserWordRequestService } from '../../../modules/word-requests';
import type { ApplicationError } from '../../../shared/application/application-error';
import { err, ok, type Result } from '../../../shared/application/result';

const applicationError: ApplicationError = {
    kind: 'conflict',
    code: 'WORD_REQUEST_CONFLICT',
    message: '이미 단어 요청이 존재합니다.',
};

const createService = (
    overrides: Partial<UserWordRequestService> = {},
): UserWordRequestService => ({
    requestAddition: jest.fn().mockResolvedValue(ok({
        requestId: 10,
        word: '가방',
        requestType: 'add',
        themes: [],
    })),
    requestAdditions: jest.fn().mockResolvedValue(ok({
        requestedWordCount: 1,
        createdWordRequestCount: 1,
        updatedWordRequestCount: 0,
        changedRegisteredWordCount: 0,
        createdThemeChangeRequestCount: 0,
        unchangedWordCount: 0,
    })),
    requestDeletion: jest.fn().mockResolvedValue(ok({
        requestId: 11,
        word: '나비',
        requestType: 'delete',
    })),
    cancel: jest.fn().mockResolvedValue(ok({
        requestId: 7,
        word: '가방',
        requestType: 'add',
    })),
    ...overrides,
});

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });

    return function Wrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
};

describe('useUserWordRequestActions', () => {
    const renderActions = ({
        service = createService(),
        isProcessing = false,
        events = [],
    }: {
        service?: UserWordRequestService;
        isProcessing?: boolean;
        events?: string[];
    } = {}) => {
        const makeError = jest.fn((error: ApplicationError) => events.push(`error:${error.kind}`));
        const setIsProcessing = jest.fn((value: SetStateAction<boolean>) => {
            events.push(`processing:${typeof value === 'function' ? value(false) : value}`);
        });
        const completeWork = jest.fn(() => {
            events.push('complete');
        });

        const view = renderHook(() => useUserWordRequestActions({
            makeError,
            setIsProcessing,
            completeWork,
            isProcessing,
            service,
        }), { wrapper: createWrapper() });

        return { ...view, makeError, setIsProcessing, completeWork, service };
    };

    it('requests deletion through the application service and completes only after success', async () => {
        const events: string[] = [];
        const service = createService({
            requestDeletion: async () => {
                events.push('request-deletion');
                return ok({ requestId: 11, word: '나비', requestType: 'delete' });
            },
        });
        const { result } = renderActions({ service, events });

        await act(async () => result.current.requestDelete('나비'));

        expect(events).toEqual(['processing:true', 'request-deletion', 'processing:false', 'complete']);
    });

    it.each([
        ['cancelAddRequest', '추가 요청 취소'],
        ['cancelDeleteRequest', '삭제 요청 취소'],
    ] as const)('%s cancels through the application service and completes after success', async (actionName, _description) => {
        const events: string[] = [];
        const cancel = jest.fn(async () => {
            events.push('cancel');
            return ok({ requestId: 7, word: '가방', requestType: 'add' as const });
        });
        const service = createService({
            cancel,
        });
        const { result } = renderActions({ service, events });

        await act(async () => result.current[actionName]('가방'));

        expect(cancel).toHaveBeenCalledWith({ word: '가방' });
        expect(events).toEqual(['processing:true', 'cancel', 'processing:false', 'complete']);
    });

    it.each(['requestDelete', 'cancelAddRequest', 'cancelDeleteRequest'] as const)(
        '%s does not start while the screen is already processing',
        async (actionName) => {
            const service = createService();
            const { result, setIsProcessing, completeWork } = renderActions({ service, isProcessing: true });

            await act(async () => result.current[actionName]('가방'));

            expect(setIsProcessing).not.toHaveBeenCalled();
            expect(service.requestDeletion).not.toHaveBeenCalled();
            expect(service.cancel).not.toHaveBeenCalled();
            expect(completeWork).not.toHaveBeenCalled();
        },
    );

    it('does not start another action while the application mutation is pending', async () => {
        let resolveRequest!: (result: Result<UserWordRequestResult>) => void;
        const pendingRequest = new Promise<Result<UserWordRequestResult>>((resolve) => {
            resolveRequest = resolve;
        });
        const requestDeletion: UserWordRequestService['requestDeletion'] = jest.fn(() => pendingRequest);
        const service = createService({ requestDeletion });
        const { result } = renderActions({ service });

        let firstRequest!: Promise<void>;
        await act(async () => {
            firstRequest = result.current.requestDelete('나비');
        });
        await waitFor(() => expect(service.requestDeletion).toHaveBeenCalledTimes(1));

        await act(async () => result.current.requestDelete('나비'));
        expect(service.requestDeletion).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveRequest(ok({ requestId: 11, word: '나비', requestType: 'delete' }));
            await firstRequest;
        });
    });

    it('starts only one mutation for back-to-back action calls before React re-renders', async () => {
        let resolveRequest!: (result: Result<UserWordRequestResult>) => void;
        const pendingRequest = new Promise<Result<UserWordRequestResult>>((resolve) => {
            resolveRequest = resolve;
        });
        const requestDeletion: UserWordRequestService['requestDeletion'] = jest.fn(() => pendingRequest);
        const service = createService({ requestDeletion });
        const { result } = renderActions({ service });

        let firstRequest!: Promise<void>;
        let secondRequest!: Promise<void>;
        act(() => {
            firstRequest = result.current.requestDelete('나비');
            secondRequest = result.current.requestDelete('나비');
        });

        try {
            await waitFor(() => expect(requestDeletion).toHaveBeenCalledTimes(1));
        } finally {
            await act(async () => {
                resolveRequest(ok({ requestId: 11, word: '나비', requestType: 'delete' }));
                await Promise.all([firstRequest, secondRequest]);
            });
        }
    });

    it.each([
        ['requestDelete', '나비', (service: UserWordRequestService) => service.requestDeletion],
        ['cancelAddRequest', '가방', (service: UserWordRequestService) => service.cancel],
        ['cancelDeleteRequest', '가방', (service: UserWordRequestService) => service.cancel],
    ] as const)('%s reports a failed Result safely and never completes', async (actionName, word, getAction) => {
        const events: string[] = [];
        const service = createService({
            requestDeletion: jest.fn().mockResolvedValue(err(applicationError)),
            cancel: jest.fn().mockResolvedValue(err(applicationError)),
        });
        const { result, makeError, completeWork } = renderActions({ service, events });

        await act(async () => result.current[actionName](word));

        expect(getAction(service)).toHaveBeenCalledWith({ word });
        expect(makeError).toHaveBeenCalledTimes(1);
        expect(makeError).toHaveBeenCalledWith(applicationError);
        expect(completeWork).not.toHaveBeenCalled();
        expect(events).toEqual(['processing:true', 'error:conflict', 'processing:false']);
    });

    it('reports a thrown service failure as a safe application error and never completes', async () => {
        const events: string[] = [];
        const service = createService({
            requestDeletion: jest.fn().mockRejectedValue(new Error('private service detail')),
        });
        const { result, makeError, completeWork } = renderActions({ service, events });

        await act(async () => result.current.requestDelete('나비'));

        expect(makeError).toHaveBeenCalledWith(expect.objectContaining({
            kind: 'infrastructure',
            message: '단어 요청 처리 중 오류가 발생했습니다.',
        }));
        expect(completeWork).not.toHaveBeenCalled();
        expect(events).toEqual(['processing:true', 'error:infrastructure', 'processing:false']);
    });
});
