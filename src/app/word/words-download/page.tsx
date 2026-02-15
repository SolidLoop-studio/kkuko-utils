import KoreanWordFilter from "./WordsDownloadHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈DB 다운로드",
        description: `끄코 유틸리티 - 오픈DB 다운로드`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈DB 다운로드",
            description: "끄코 유틸리티 - 오픈DB 다운로드",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/words-download",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function wordsDownloadPage(){
    return <KoreanWordFilter />
}