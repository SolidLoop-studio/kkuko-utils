import { SCM } from '@/app/lib/supabaseClient';
import type { PostgrestError } from "@supabase/supabase-js";
import { isNoin } from "@/app/lib/lib";
import type { RootState } from '@/app/store/store';
import React, { useCallback } from 'react';

interface DocsLogData {
    readonly word: string;
    readonly docs_id: number;
    readonly add_by: string | null;
    readonly type: "add" | "delete";
}

interface WordLogData {
    readonly word: string;
    readonly make_by: string | null;
    readonly processed_by: string | null;
    readonly r_type: "add" | "delete";
    readonly state: "approved" | "rejected";
}

type DocsLogArrayOfData = DocsLogData[];
type WordLogArrayOfData = WordLogData[];

export const useWorkFunc = ({ makeError, setIsProcessing, user, isProcessing, CompWork }: {
    makeError: (error: PostgrestError) => void,
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
    user: RootState['user'],
    CompWork: () => void,
    isProcessing: boolean
}) => {
    const WriteDocsLog = useCallback(async (logsData: DocsLogArrayOfData) => {
        const { error: insertDocsLogDataError } = await SCM.add().docsLog(logsData);
        if (insertDocsLogDataError) { throw insertDocsLogDataError }
    }, []);

    const WriteWordLog = useCallback(async (logsData: WordLogArrayOfData) => {
        const { error: insertWordLogDataError } = await SCM.add().wordLog(logsData);
        if (insertWordLogDataError) { throw insertWordLogDataError }
    }, []);

    const beforeCheck = () => user.role !== "admin" && user.role !== "r4" && isProcessing;

    const AddAccept = useCallback(async (word: string) => {
        if (beforeCheck()) return;
        setIsProcessing(true);

        try {
            // 1. 추가 요청 단어 정보 가져오기
            const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
            if (getWaitWordDataError) return makeError(getWaitWordDataError)
            if (!getWaitWordData) return;

            // 2. 추가 요청 단어의 주제 정보 가져오기
            const { data: getWordThemesData, error: getWordThemesDataError } = await SCM.get().waitWordThemes(getWaitWordData.id);
            if (getWordThemesDataError) makeError(getWordThemesDataError);
            if (!getWordThemesData) return;

            // 3. 단어 데이터 추가
            const isNoinWord = isNoin(getWordThemesData.map(({ themes }) => themes.code))
            const insertWordData = { word: getWaitWordData.word, noin_canuse: isNoinWord, added_by: getWaitWordData.requested_by };
            const { data: getAddAcceptDatab, error: getAddAcceptDataError } = await SCM.add().word([insertWordData])
            if (getAddAcceptDataError) return makeError(getAddAcceptDataError);

            const getAddAcceptData = getAddAcceptDatab[0];

            // 4. 단어 주제 데이터 추가
            const insertWordThemesData = getWordThemesData.map((t) => ({
                word_id: getAddAcceptData.id,
                theme_id: t.theme_id,
            }));
            const { error: getAddAcceptThemesDataError } = await SCM.add().wordThemes(insertWordThemesData);
            if (getAddAcceptThemesDataError) return makeError(getAddAcceptThemesDataError);

            // 5. 단어 추가 로그 등록
            const insertWordLogData = {
                word: getWaitWordData.word,
                make_by: getWaitWordData.requested_by,
                processed_by: user.uuid || null,
                r_type: "add",
                state: "approved",
            } as const;
            await WriteWordLog([insertWordLogData]);

            // 6. 문서 처리

            // 6.2 주제, 글자 문서 로그 추가
            const { data: docsDatas, error: docsError } = await SCM.get().allDocs();
            if (docsError) return makeError(docsError)
            const letterDocs = docsDatas.filter(({ typez }) => typez === "letter");
            const themeDocs = docsDatas.filter(({ typez }) => typez === "theme");

            const okLetterDocs = letterDocs
                .filter(({ name }) => getAddAcceptData.word[getAddAcceptData.word.length - 1] === name)
                .map(d => ({
                    word: getWaitWordData.word,
                    docs_id: d.id,
                    add_by: getWaitWordData.requested_by,
                    type: "add" as const
                }));
            await WriteDocsLog(okLetterDocs);
            const okThemeDocs = themeDocs
                .filter(({ name }) => getWordThemesData.some(b => b.themes.name === name))
                .map(d => ({
                    word: getWaitWordData.word,
                    docs_id: d.id,
                    add_by: getWaitWordData.requested_by,
                    type: "add" as const
                }))
            const okThemeDocsA = themeDocs
                .filter(({ name }) => getWordThemesData.some(b => b.themes.name === name))
                .map(({ id }) => id);
            await WriteDocsLog(okThemeDocs);

            // 6.3 필요정보 업데이트 처리
            await SCM.update().docsLastUpdate(okThemeDocsA);
            if (getWaitWordData.requested_by) {
                await SCM.update().userContribution({ userId: getWaitWordData.requested_by, })
            }

            // 7. 추가 요청 테이블에서 삭제
            const { error: deleteWaitWordDataError } = await SCM.delete().waitWordsByIds([getWaitWordData.id])
            if (deleteWaitWordDataError) return makeError(deleteWaitWordDataError);

            setIsProcessing(false);
            CompWork();
        } catch (error) {
            makeError(error as PostgrestError);
            setIsProcessing(false);
        }
    }, []);

    const AddReject = useCallback(async (word: string) => {
        // 권한 체크 및 중복 요청 방지
        if (beforeCheck()) return;
        setIsProcessing(true);

        // 1. 추가 요청단어 정보 가져오기
        const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
        if (getWaitWordDataError) { return makeError(getWaitWordDataError); }
        if (!getWaitWordData) return;

        // 2.1 추가 요청 거부
        const { error: deleteWaitWordDataError } = await SCM.delete().waitWordsByIds([getWaitWordData.id]);
        if (deleteWaitWordDataError) { return makeError(deleteWaitWordDataError); }

        // 2.2 로그 등록
        const insertWordLogData = {
            word: getWaitWordData.word,
            make_by: getWaitWordData.requested_by,
            processed_by: user.uuid || null,
            r_type: "add",
            state: "rejected"
        } as const;
        await WriteWordLog([insertWordLogData]);

        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    const DeleteAccept = useCallback(async (word: string) => {
        // 권한 체크 및 중복 요청 방지
        if (beforeCheck()) return;
        setIsProcessing(true);

        // 1. 삭제 요청단어 정보 가져오기
        const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
        if (getWaitWordDataError) { return makeError(getWaitWordDataError); }
        if (!getWaitWordData) return;

        const { data: getWordData, error: getWordError } = await SCM.get().wordInfoByWord(word);
        if (getWordError) { return makeError(getWordError); }
        if (!getWordData) return;

        const { data: themeWordData, error: themeWordError } = await SCM.get().wordThemeByWordId(getWordData.id)
        if (themeWordError) { return makeError(themeWordError); }

        // 2.1 삭제요청 단어를 words 테이블에서 삭제
        const { error: deleteWordDataError } = await SCM.delete().wordByWord(getWaitWordData.word);
        if (deleteWordDataError) { return makeError(deleteWordDataError); }

        // 2.2 대기큐에서 제거
        const { error: deleteWaitWordDataError } = await SCM.delete().waitWordById(getWaitWordData.id);
        if (deleteWaitWordDataError) { return makeError(deleteWaitWordDataError); }

        // 2.3 로그 등록
        const insertWordLogData = {
            word: getWaitWordData.word,
            make_by: getWaitWordData.requested_by,
            processed_by: user.uuid || null,
            r_type: "delete",
            state: "approved"
        } as const;
        await WriteWordLog([insertWordLogData]);

        const { data: docsDatas, error: docsError } = await SCM.get().allDocs();
        if (docsError) return makeError(docsError)
        const letterDocs = docsDatas.filter(({ typez }) => typez === "letter");
        const themeDocs = docsDatas.filter(({ typez }) => typez === "theme");

        const okLetterDocs = letterDocs
            .filter(({ name }) => getWaitWordData.word[getWaitWordData.word.length - 1] === name)
            .map(d => ({
                word: getWaitWordData.word,
                docs_id: d.id,
                add_by: getWaitWordData.requested_by,
                type: "delete" as const
            }));

        const okThemeDocs = themeDocs
            .filter(({ name }) => themeWordData.some(b => b.themes.name === name))
            .map(d => ({
                word: getWaitWordData.word,
                docs_id: d.id,
                add_by: getWaitWordData.requested_by,
                type: "delete" as const
            }))

        await WriteDocsLog(okLetterDocs);
        await WriteDocsLog(okThemeDocs);

        const okThemeDocsA = themeDocs
            .filter(({ name }) => themeWordData.some(b => b.themes.name === name))
            .map(({ id }) => id);
        await WriteDocsLog(okThemeDocs);

        await SCM.update().docsLastUpdate(okThemeDocsA);

        if (getWaitWordData.requested_by) {
            await SCM.update().userContribution({ userId: getWaitWordData.requested_by, })
        }


        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    const DeleteReject = useCallback(async (word: string) => {
        // 권한 체크 및 중복 요청 방지
        if (beforeCheck()) return;
        setIsProcessing(true);

        // 1. 삭제 요청단어 정보 가져오기
        const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
        if (getWaitWordDataError) { return makeError(getWaitWordDataError); }
        if (!getWaitWordData) return;

        // 2.1 삭제 요청 거부
        const { error: deleteWaitWordDataError } = await SCM.delete().waitWordById(getWaitWordData.id);
        if (deleteWaitWordDataError) { return makeError(deleteWaitWordDataError); }

        // 2.2 로그 등록
        const insertWordLogData = {
            word: getWaitWordData.word,
            make_by: getWaitWordData.requested_by,
            processed_by: user.uuid || null,
            r_type: "delete",
            state: "rejected"
        } as const;
        await WriteWordLog([insertWordLogData]);

        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    const CancelAddRequest = useCallback(async (word: string) => {
        // 중복 요청 방지
        if (isProcessing) return;
        setIsProcessing(true);

        // 1. 삭제 요청단어 정보 가져오기
        const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
        if (getWaitWordDataError) { return makeError(getWaitWordDataError); }
        if (!getWaitWordData) return;

        // 2. 대기큐에서 삭제
        const { error: deleteWaitWordDataError } = await SCM.delete().waitWordById(getWaitWordData.id);
        if (deleteWaitWordDataError) { return makeError(deleteWaitWordDataError); }

        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    const CancelDeleteRequest = useCallback(async (word: string) => {
        // 중복 요청 방지
        if (isProcessing) return;
        setIsProcessing(true);

        // 1. 삭제 요청단어 정보 가져오기
        const { data: getWaitWordData, error: getWaitWordDataError } = await SCM.get().waitWordInfoByWord(word);
        if (getWaitWordDataError) { return makeError(getWaitWordDataError); }
        if (!getWaitWordData) return;

        // 2. 대기큐에서 삭제
        const { error: deleteWaitWordDataError } = await SCM.delete().waitWordById(getWaitWordData.id);
        if (deleteWaitWordDataError) { return makeError(deleteWaitWordDataError); }

        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    const DeleteByAdmin = useCallback(async (word: string) => {
        // 권한 체크 및 중복 요청 방지
        if (beforeCheck()) return;
        setIsProcessing(true);

        // 1. 즉시 삭제할 단어 정보 가지고 오기
        const { data: getWordData, error: getWordDataError } = await SCM.get().wordInfoByWord(word);
        if (getWordDataError) { return makeError(getWordDataError); }
        if (!getWordData) return;

        const { data: themeWordData, error: themeWordError } = await SCM.get().wordThemeByWordId(getWordData.id)
        if (themeWordError) { return makeError(themeWordError); }

        // 2 로그에 등록
        const insertWordLogData = {
            word: word,
            make_by: user.uuid || null,
            processed_by: user.uuid || null,
            r_type: "delete",
            state: "approved"
        } as const;
        await WriteWordLog([insertWordLogData]);

        const { data: docsDatas, error: docsError } = await SCM.get().allDocs();
        if (docsError) return makeError(docsError)
        const letterDocs = docsDatas.filter(({ typez }) => typez === "letter");
        const themeDocs = docsDatas.filter(({ typez }) => typez === "theme");

        const okLetterDocs = letterDocs
            .filter(({ name }) => getWordData.word[getWordData.word.length - 1] === name)
            .map(d => ({
                word: getWordData.word,
                docs_id: d.id,
                add_by: user.uuid || null,
                type: "delete" as const
            }));

        const okThemeDocs = themeDocs
            .filter(({ name }) => themeWordData.some(b => b.themes.name === name))
            .map(d => ({
                word: getWordData.word,
                docs_id: d.id,
                add_by: user.uuid || null,
                type: "delete" as const
            }))

        await WriteDocsLog(okLetterDocs);
        await WriteDocsLog(okThemeDocs);

        // 3. 필요정보 업데이트
        const okThemeDocsA = themeDocs
            .filter(({ name }) => themeWordData.some(b => b.themes.name === name))
            .map(({ id }) => id);
        await WriteDocsLog(okThemeDocs);

        await SCM.update().docsLastUpdate(okThemeDocsA);

        if (user.uuid) {
            await SCM.update().userContribution({ userId: user.uuid, })
        }

        // 4. 단어 삭제
        const { error: deleteWordDataError } = await SCM.delete().wordById(getWordData.id);
        if (deleteWordDataError) {
            makeError(deleteWordDataError);
            setIsProcessing(false);
            return;
        }

        setIsProcessing(false);
        CompWork();
        return;

    }, []);

    const RequestDelete = useCallback(async (word: string) => {
        // 중복 요청 방지
        if (isProcessing) return;
        setIsProcessing(true);

        // 1. 삭제 요청할 타깃 단어 정보 가지고 오기
        const { data: getWordData, error: getWordDataError } = await SCM.get().wordInfoByWord(word);
        if (getWordDataError) { return makeError(getWordDataError); }
        if (!getWordData) return;

        // 2. 대기큐에 등록
        const insertWaitWordData = {
            word: word,
            requested_by: user.uuid || null,
            request_type: "delete",
            word_id: getWordData.id
        } as const;
        const { data: insertWaitWordDataA, error: insertWaitWordDataError } = await SCM.add().waitWord(insertWaitWordData);
        if (insertWaitWordDataError) {
            makeError(insertWaitWordDataError);
            setIsProcessing(false);
            return;
        }
        if (!insertWaitWordDataA) return;

        setIsProcessing(false);
        CompWork();
        return;
    }, []);

    return { AddAccept, DeleteAccept, AddReject, DeleteReject, CancelAddRequest, CancelDeleteRequest, DeleteByAdmin, RequestDelete }

}