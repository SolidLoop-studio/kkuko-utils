import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';

import { SCM } from '@/src/app/lib/supabaseClient';
import type { RootState } from '@/src/app/store/store';

type UseUserWordRequestActionsOptions = {
    makeError(error: PostgrestError): void;
    setIsProcessing: Dispatch<SetStateAction<boolean>>;
    user: RootState['user'];
    completeWork(): void;
    isProcessing: boolean;
};

/** 문서 단어 화면의 기존 사용자 요청 생성·취소 동작을 제공합니다. */
export function useUserWordRequestActions({
    makeError,
    setIsProcessing,
    user,
    completeWork,
    isProcessing,
}: UseUserWordRequestActionsOptions) {
    const cancelRequest = useCallback(async (word: string) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const { data: waitWord, error: waitWordError } = await SCM.get().waitWordInfoByWord(word);
        if (waitWordError) return makeError(waitWordError);
        if (!waitWord) return;

        const { error: deleteError } = await SCM.delete().waitWordById(waitWord.id);
        if (deleteError) return makeError(deleteError);

        setIsProcessing(false);
        completeWork();
    }, [completeWork, isProcessing, makeError, setIsProcessing]);

    const RequestDelete = useCallback(async (word: string) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const { data: registeredWord, error: registeredWordError } = await SCM.get().wordInfoByWord(word);
        if (registeredWordError) return makeError(registeredWordError);
        if (!registeredWord) return;

        const { data: waitWord, error: waitWordError } = await SCM.add().waitWord({
            word,
            requested_by: user.uuid || null,
            request_type: 'delete',
            word_id: registeredWord.id,
        });
        if (waitWordError) {
            makeError(waitWordError);
            setIsProcessing(false);
            return;
        }
        if (!waitWord) return;

        setIsProcessing(false);
        completeWork();
    }, [completeWork, isProcessing, makeError, setIsProcessing, user.uuid]);

    return {
        CancelAddRequest: cancelRequest,
        CancelDeleteRequest: cancelRequest,
        RequestDelete,
    };
}
