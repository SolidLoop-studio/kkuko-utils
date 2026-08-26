import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock(
    '../../../../modules/word-moderation/infrastructure/browser/browser-word-moderation-services',
    () => ({ createBrowserWordModerationServices: jest.fn() }),
);

import { useDirectWordAddition } from '@/src/modules/word-moderation/presentation/use-direct-word-addition';
import { err, ok, type Result } from '@/src/shared/application/result';
import type {
    DirectWordAdditionCommand,
    DirectWordAdditionResult,
} from '@/src/modules/word-moderation/application/direct-word-addition-types';

const command: DirectWordAdditionCommand = { word: '사과', themeCodes: ['animal'] };
const success: DirectWordAdditionResult = {
    wordId: 31,
    word: '사과',
    noinCanUse: false,
    themeIds: [4],
    affectedDocsIds: [10],
};

describe('useDirectWordAddition', () => {
    it('coalesces duplicate submissions while exposing pending state', async () => {
        let resolve!: (value: Result<DirectWordAdditionResult>) => void;
        const promise = new Promise<Result<DirectWordAdditionResult>>((nextResolve) => {
            resolve = nextResolve;
        });
        const service = { add: jest.fn(() => promise) };
        const { result } = renderHook(() => useDirectWordAddition(service));

        let first!: Promise<Result<DirectWordAdditionResult>>;
        let second!: Promise<Result<DirectWordAdditionResult>>;
        act(() => {
            first = result.current.addDirectly(command);
            second = result.current.addDirectly(command);
        });

        expect(service.add).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);
        await waitFor(() => expect(result.current.isPending).toBe(true));
        await act(async () => resolve(ok(success)));
        await expect(first).resolves.toEqual(ok(success));
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('stores returned errors and clears them', async () => {
        const applicationError = { kind: 'conflict' as const, message: '이미 존재하는 단어입니다.' };
        const service = { add: jest.fn().mockResolvedValue(err(applicationError)) };
        const { result } = renderHook(() => useDirectWordAddition(service));

        await act(async () => result.current.addDirectly(command));
        expect(result.current.error).toEqual(applicationError);
        act(() => result.current.clearError());
        expect(result.current.error).toBeNull();
    });

    it('converts thrown failures to a stable infrastructure result', async () => {
        const service = { add: jest.fn().mockRejectedValue(new Error('sensitive detail')) };
        const { result } = renderHook(() => useDirectWordAddition(service));

        let actionResult: Result<DirectWordAdditionResult> | undefined;
        await act(async () => {
            actionResult = await result.current.addDirectly(command);
        });

        expect(actionResult).toMatchObject({ ok: false, error: { kind: 'infrastructure' } });
        expect(result.current.error).toMatchObject({ kind: 'infrastructure' });
    });
});
