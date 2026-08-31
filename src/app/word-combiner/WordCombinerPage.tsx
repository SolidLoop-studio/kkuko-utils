"use client";

import ErrorPage from "../components/ErrorPage";
import LoadingPage from '@/src/app/components/LoadingPage';
import WordCombinerClient from "./WordCombinerClient";
import { useWordCombinerCandidates } from '../../modules/word-catalog';

export default function WordCombinerPage() {
    const { data: candidates, error, isLoading } = useWordCombinerCandidates();

    if (isLoading || candidates === undefined && error === null) {
        return <LoadingPage title="단어 데이터" />;
    }

    if (error) return <ErrorPage message={error.message} />;

    const len6 = candidates
        .filter(({ word }) => word.length === 6)
        .map(({ word }) => word);
    const len5 = candidates
        .filter(({ word }) => word.length === 5)
        .map(({ word }) => word);

    return <WordCombinerClient prop={{ len5, len6 }} />;
}
