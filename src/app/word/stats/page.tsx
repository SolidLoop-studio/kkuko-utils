import { WordStatsHome } from "./WordStatsHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 단어 통계",
        description: "끄코 유틸리티 - 단어 통계 페이지",
        openGraph: {
            title: "끄코 유틸리티 - 단어 통계",
            description: "끄코 유틸리티 - 단어 통계 페이지",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/stats",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function WordStatsPage() {
    return <WordStatsHome />;
}
