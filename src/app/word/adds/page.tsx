import WordsAddHome from "./WordsAddHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 단어 대량 추가",
        description: `끄코 유틸리티 - 오픈DB 단어 대량 추가`,
        openGraph: {
            title: "끄코 유틸리티 - 단어 대량 추가",
            description: "끄코 유틸리티 - 오픈DB 단어 대량 추가",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/adds",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function AddsWordPage(){
    return <WordsAddHome />
}