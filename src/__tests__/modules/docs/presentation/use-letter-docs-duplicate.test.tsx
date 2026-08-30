import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

jest.mock(
    '../../../../modules/docs/infrastructure/browser/browser-docs-services',
    () => ({ createBrowserDocsServices: jest.fn() }),
);

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import { createBrowserDocsServices } from '@/src/modules/docs/infrastructure/browser/browser-docs-services';
import { docsQueryKeys } from '@/src/modules/docs/presentation/docs-query-keys';
import { useLetterDocsDuplicate } from '@/src/modules/docs/presentation/use-letter-docs-duplicate';

const createQueryWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retryDelay: 0, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        QueryWrapper: ({ children }: PropsWithChildren) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    };
};

const mockDuplicateService = (result: Result<boolean>) => {
    const check = jest.fn().mockResolvedValue(result);
    jest.mocked(createBrowserDocsServices).mockReturnValue({
        letterDocsDuplicateQueryService: { check },
    } as unknown as ReturnType<typeof createBrowserDocsServices>);
    return check;
};

describe('useLetterDocsDuplicate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('stays disabled until refetch and caches the duplicate boolean at the exact key', async () => {
        const check = mockDuplicateService(ok(true));
        const { queryClient, QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useLetterDocsDuplicate('가'), {
            wrapper: QueryWrapper,
        });

        expect(docsQueryKeys.letterDuplicate('가')).toEqual([
            'docs', 'letter', 'duplicate', '가',
        ]);
        expect(check).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(['docs', 'letter', 'duplicate', '가']))
            .toBeUndefined();

        await act(async () => {
            await result.current.refetch();
        });

        expect(check).toHaveBeenCalledWith('가');
        expect(check).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(['docs', 'letter', 'duplicate', '가']))
            .toBe(true);
    });

    it('does not retry a validation error', async () => {
        const validationError: ApplicationError = {
            kind: 'validation',
            message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        };
        const check = mockDuplicateService(err(validationError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useLetterDocsDuplicate(''), {
            wrapper: QueryWrapper,
        });

        let queryError: unknown;
        await act(async () => {
            queryError = (await result.current.refetch()).error;
        });

        expect(queryError).toEqual(validationError);
        expect(check).toHaveBeenCalledTimes(1);
    });

    it('retries an infrastructure error using the established docs query policy', async () => {
        const infrastructureError: ApplicationError = {
            kind: 'infrastructure',
            message: '문서 추가 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        };
        const check = mockDuplicateService(err(infrastructureError));
        const { QueryWrapper } = createQueryWrapper();
        const { result } = renderHook(() => useLetterDocsDuplicate('가'), {
            wrapper: QueryWrapper,
        });

        let queryError: unknown;
        await act(async () => {
            queryError = (await result.current.refetch()).error;
        });

        expect(queryError).toEqual(infrastructureError);
        expect(check).toHaveBeenCalledTimes(4);
    });
});
