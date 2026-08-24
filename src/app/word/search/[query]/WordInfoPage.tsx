"use client";

import axios from 'axios';
import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';

import ErrorPage from '@/src/app/components/ErrorPage';
import LoadingPage from '@/src/app/components/LoadingPage';
import { calculateKoreanInitials, count } from '@/src/app/lib/lib';
import {
    type WordConnectionDirection,
    type WordDetail,
    useRandomConnectedWord,
    useWordDetail,
} from '@/src/modules/word-catalog';

import WordInfo, { type WordInfoProps } from './WordInfo';

const missionLetters = '가나다라마바사아자차카타파하';

type MappedWordInfo = Omit<
    WordInfoProps,
    | 'moreExplanation'
    | 'goFirstLetterWord'
    | 'goLastLetterWord'
    | 'reloadWordInfo'
    | 'isConnectionLoading'
>;

/** 조회 projection을 기존 단어 정보 UI 계약으로 변환한다. */
const mapWordDetail = (detail: WordDetail): MappedWordInfo => ({
    word: detail.word,
    initial: calculateKoreanInitials(detail.word),
    length: detail.word.length,
    isChainable: detail.canUseInChain,
    isSeniorApproved: detail.canUseWithoutInjeong,
    dbId: detail.id,
    missionLetter: [...missionLetters]
        .map((letter): [string, number] => [letter, count(detail.word, letter)])
        .filter(([, letterCount]) => letterCount > 0),
    status: detail.status === 'registered'
        ? 'ok'
        : detail.status === 'pending-addition'
            ? '추가요청'
            : '삭제요청',
    requester: detail.requesterNickname,
    requester_uuid: detail.requesterId,
    requestTime: detail.requestedAt,
    documents: detail.documents.map((document) => ({
        doc_id: document.id,
        doc_name: document.name,
    })),
    topic: {
        ok: detail.themes.approved,
        waitAdd: detail.themes.pendingAddition,
        waitDel: detail.themes.pendingDeletion,
    },
    goFirstLetterWords: detail.previousWordCount,
    goLastLetterWords: detail.nextWordCount,
});

export default function WordInfoPage({ query }: { query: string }) {
    const router = useRouter();
    const detailQuery = useWordDetail(query);
    const connectedWord = useRandomConnectedWord();
    const [kkukoWikiUrl, setKkukoWikiUrl] = useState<string>();
    const detail = detailQuery.data;

    useEffect(() => {
        setKkukoWikiUrl(undefined);
        if (!detail || detail.status === 'pending-addition') return;

        let isCurrentWord = true;
        void axios.get(`/api/get_kkukowiki?title=${detail.word}`)
            .then((response) => {
                if (isCurrentWord && response.status === 200) {
                    setKkukoWikiUrl(`https://kkukowiki.kr/w/${detail.word}`);
                }
            })
            .catch(() => undefined);

        return () => {
            isCurrentWord = false;
        };
    }, [detail?.status, detail?.word]);

    if (detailQuery.error?.kind === 'not-found') return notFound();
    if (detailQuery.isPending) return <LoadingPage title="단어 정보" />;
    if (detailQuery.error) return <ErrorPage message={detailQuery.error.message} />;
    if (connectedWord.error) return <ErrorPage message={connectedWord.error.message} />;
    if (!detail) return null;

    const navigateToConnectedWord = async (
        direction: WordConnectionDirection,
        letters: string[],
    ) => {
        try {
            const selectedWord = await connectedWord.mutateAsync({ direction, letters });
            router.push(`/word/search/${selectedWord ?? detail.word}`);
        } catch {
            // React Query exposes the stable ApplicationError on connectedWord.error.
        }
    };

    const wordInfo: WordInfoProps = {
        ...mapWordDetail(detail),
        isConnectionLoading: connectedWord.isPending,
        moreExplanation: kkukoWikiUrl ? (
            <a
                href={kkukoWikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 transition-colors"
            >
                해당 단어가 끄코위키에 있습니다.
            </a>
        ) : undefined,
        goFirstLetterWord: (letters) => navigateToConnectedWord('previous', letters),
        goLastLetterWord: (letters) => navigateToConnectedWord('next', letters),
        reloadWordInfo: () => {
            void detailQuery.refetch();
        },
    };

    return <WordInfo wordInfo={wordInfo} />;
}
