import { act, renderHook } from '@testing-library/react';
import type { SetStateAction } from 'react';

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        get: jest.fn(),
        delete: jest.fn(),
        add: jest.fn(),
    },
}));

import { SCM } from '../../../app/lib/supabaseClient';
import { useUserWordRequestActions } from '../../../app/words-docs/[id]/use-user-word-request-actions';

const databaseError = {
    name: 'PostgrestError',
    message: 'private database detail',
    details: '',
    hint: '',
    code: 'XX000',
};

const waitWord = {
    id: 7,
    request_type: 'add' as const,
    requested_at: '2026-08-22T00:00:00.000Z',
    requested_by: 'requester-1',
    status: 'pending' as const,
    word: '가방',
    word_id: null,
    users: { nickname: '신청자' },
};

const registeredWord = {
    added_at: '2026-08-22T00:00:00.000Z',
    added_by: 'maker-1',
    chosungs: 'ㄴㅂ',
    first_letter: '나',
    id: 11,
    k_canuse: true,
    last_letter: '비',
    length: 2,
    mission_mark: 0,
    noin_canuse: true,
    word: '나비',
    users: { nickname: '등록자' },
};

describe('useUserWordRequestActions', () => {
    const getManager = {
        waitWordInfoByWord: jest.fn(),
        wordInfoByWord: jest.fn(),
    };
    const deleteManager = { waitWordById: jest.fn() };
    const addManager = { waitWord: jest.fn() };

    beforeEach(() => {
        jest.mocked(SCM.get).mockReturnValue(getManager as never);
        jest.mocked(SCM.delete).mockReturnValue(deleteManager as never);
        jest.mocked(SCM.add).mockReturnValue(addManager as never);
        getManager.waitWordInfoByWord.mockResolvedValue({ data: waitWord, error: null });
        getManager.wordInfoByWord.mockResolvedValue({ data: registeredWord, error: null });
        deleteManager.waitWordById.mockResolvedValue({ data: null, error: null });
        addManager.waitWord.mockResolvedValue({
            data: { ...waitWord, request_type: 'delete', word: '나비', word_id: 11 },
            error: null,
        });
    });

    const renderActions = (isProcessing = false, events: string[] = []) => {
        const makeError = jest.fn(() => events.push('error'));
        const setIsProcessing = jest.fn((value: SetStateAction<boolean>) => {
            events.push(`processing:${typeof value === 'function' ? value(false) : value}`);
        });
        const completeWork = jest.fn(() => events.push('complete'));

        const view = renderHook(() => useUserWordRequestActions({
            makeError,
            setIsProcessing,
            user: { username: 'tester', uuid: 'user-1', role: 'r1' },
            completeWork,
            isProcessing,
        }));

        return { ...view, makeError, setIsProcessing, completeWork };
    };

    it.each([
        ['CancelAddRequest', '추가 요청 취소'],
        ['CancelDeleteRequest', '삭제 요청 취소'],
    ] as const)('%s는 단어 조회 후 해당 대기 행을 삭제하고 마지막 성공 뒤에만 완료한다', async (actionName, _description) => {
        const events: string[] = [];
        getManager.waitWordInfoByWord.mockImplementation(async () => {
            events.push('lookup-wait-word');
            return { data: waitWord, error: null };
        });
        deleteManager.waitWordById.mockImplementation(async () => {
            events.push('delete-wait-word');
            return { data: null, error: null };
        });
        const { result } = renderActions(false, events);

        await act(async () => result.current[actionName]('가방'));

        expect(getManager.waitWordInfoByWord).toHaveBeenCalledWith('가방');
        expect(deleteManager.waitWordById).toHaveBeenCalledWith(7);
        expect(events).toEqual([
            'processing:true',
            'lookup-wait-word',
            'delete-wait-word',
            'processing:false',
            'complete',
        ]);
    });

    it('RequestDelete는 등록 단어를 조회해 기존 wait_words payload를 삽입한다', async () => {
        const events: string[] = [];
        getManager.wordInfoByWord.mockImplementation(async () => {
            events.push('lookup-registered-word');
            return { data: registeredWord, error: null };
        });
        addManager.waitWord.mockImplementation(async () => {
            events.push('insert-wait-word');
            return {
                data: { ...waitWord, request_type: 'delete', word: '나비', word_id: 11 },
                error: null,
            };
        });
        const { result } = renderActions(false, events);

        await act(async () => result.current.RequestDelete('나비'));

        expect(getManager.wordInfoByWord).toHaveBeenCalledWith('나비');
        expect(addManager.waitWord).toHaveBeenCalledWith({
            word: '나비',
            requested_by: 'user-1',
            request_type: 'delete',
            word_id: 11,
        });
        expect(events).toEqual([
            'processing:true',
            'lookup-registered-word',
            'insert-wait-word',
            'processing:false',
            'complete',
        ]);
    });

    it.each(['CancelAddRequest', 'CancelDeleteRequest', 'RequestDelete'] as const)(
        '%s는 이미 처리 중이면 어떤 SCM 호출도 시작하지 않는다',
        async (actionName) => {
            const { result, setIsProcessing, completeWork } = renderActions(true);

            await act(async () => result.current[actionName]('가방'));

            expect(setIsProcessing).not.toHaveBeenCalled();
            expect(SCM.get).not.toHaveBeenCalled();
            expect(SCM.delete).not.toHaveBeenCalled();
            expect(SCM.add).not.toHaveBeenCalled();
            expect(completeWork).not.toHaveBeenCalled();
        },
    );

    it('취소의 마지막 delete가 실패하면 오류 callback만 호출하고 완료하지 않는다', async () => {
        deleteManager.waitWordById.mockResolvedValue({ data: null, error: databaseError });
        const { result, makeError, completeWork } = renderActions();

        await act(async () => result.current.CancelAddRequest('가방'));

        expect(makeError).toHaveBeenCalledWith(databaseError);
        expect(completeWork).not.toHaveBeenCalled();
    });

    it('삭제 요청 insert가 실패하면 오류 callback만 호출하고 완료하지 않는다', async () => {
        addManager.waitWord.mockResolvedValue({ data: null, error: databaseError });
        const { result, makeError, completeWork } = renderActions();

        await act(async () => result.current.RequestDelete('나비'));

        expect(makeError).toHaveBeenCalledWith(databaseError);
        expect(completeWork).not.toHaveBeenCalled();
    });
});
