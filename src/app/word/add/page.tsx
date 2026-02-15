import WordAddHome from "./WordAddHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 단어 추가",
        description: `끄코 유틸리티 - 오픈DB 단어 추가`,
        openGraph: {
            title: "끄코 유틸리티 - 단어 추가",
            description: "끄코 유틸리티 - 오픈DB 단어 추가",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/add",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default async function WordAddPage() {
    return (
        <div className="max-w-5xl mx-auto px-4 py-8 mb-20 dark:bg-gray-900">
            <WordAddHome />
        </div>
    );
}